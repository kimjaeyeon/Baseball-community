import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFile = promisify(execFileCallback);
const dbContainer = "supabase_db_community-site";

async function psql(sql: string): Promise<string> {
  const { stdout } = await execFile(
    "docker",
    [
      "exec",
      dbContainer,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-c",
      sql,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return stdout.trim();
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function createUser(nickname: string): Promise<string> {
  const id = randomUUID();
  await psql(
    `insert into auth.users (id, raw_user_meta_data) values (${sqlLiteral(id)}::uuid, jsonb_build_object('nickname', ${sqlLiteral(nickname)}));`,
  );
  return id;
}

async function waitForSleepingTransaction(applicationName: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const waitEvent = await psql(
      `select coalesce(wait_event, '') from pg_stat_activity where application_name = ${sqlLiteral(applicationName)};`,
    );
    if (waitEvent === "PgSleep") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`transaction ${applicationName} did not enter pg_sleep`);
}

function authenticatedTransaction(
  applicationName: string,
  userId: string,
  insertSql: string,
): Promise<string> {
  return psql(`
    begin;
    set local statement_timeout = '15s';
    set local application_name = ${sqlLiteral(applicationName)};
    set local role authenticated;
    set local request.jwt.claims = ${sqlLiteral(JSON.stringify({ sub: userId }))};
    ${insertSql}
    select pg_sleep(2);
    commit;
  `);
}

function settle(transaction: Promise<string>): Promise<PromiseSettledResult<string>> {
  return transaction.then(
    (value) => ({ status: "fulfilled", value }),
    (reason) => ({ status: "rejected", reason }),
  );
}

async function cleanupUser(userId: string): Promise<void> {
  await psql(`
    delete from public.notifications where user_id = ${sqlLiteral(userId)}::uuid or actor_id = ${sqlLiteral(userId)}::uuid
      or post_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid);
    delete from public.reports where reporter_id = ${sqlLiteral(userId)}::uuid
      or (target_type = 'post' and target_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid))
      or (target_type = 'comment' and target_id in (select id from public.comments where author_id = ${sqlLiteral(userId)}::uuid));
    delete from public.post_views where post_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid);
    delete from public.post_likes where user_id = ${sqlLiteral(userId)}::uuid
      or post_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid);
    delete from public.comments where author_id = ${sqlLiteral(userId)}::uuid
      or post_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid);
    delete from public.post_images where post_id in (select id from public.posts where author_id = ${sqlLiteral(userId)}::uuid);
    delete from public.posts where author_id = ${sqlLiteral(userId)}::uuid;
    delete from auth.users where id = ${sqlLiteral(userId)}::uuid;
  `);
}

test("동시 글 작성도 10분당 5개 제한을 넘기지 않는다", async () => {
  let userId: string | undefined;
  let txA: Promise<PromiseSettledResult<string>> | undefined;
  try {
    userId = await createUser(`rlp${randomUUID().slice(0, 8)}`);
    await psql(`
      insert into public.posts (board_id, author_id, kind, title, body)
      select 1, ${sqlLiteral(userId)}::uuid, 'text', '동시 글 제한 ' || n, '본문'
      from generate_series(1, 4) n;
    `);

    const applicationName = `ratelimit-post-${randomUUID()}`;
    txA = settle(authenticatedTransaction(
      applicationName,
      userId,
      `insert into public.posts (board_id, author_id, kind, title, body) values (1, ${sqlLiteral(userId)}::uuid, 'text', '동시 글 A', '본문');`,
    ));
    await waitForSleepingTransaction(applicationName);
    const txB = settle(authenticatedTransaction(
      `ratelimit-post-${randomUUID()}`,
      userId,
      `insert into public.posts (board_id, author_id, kind, title, body) values (1, ${sqlLiteral(userId)}::uuid, 'text', '동시 글 B', '본문');`,
    ));

    const results = await Promise.all([txA, txB]);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toContain("잠시 후 다시 시도해 주세요");
    expect(
      await psql(`select count(*) from public.posts where author_id = ${sqlLiteral(userId)}::uuid;`),
    ).toBe("5");
  } finally {
    if (txA) await txA;
    if (userId) await cleanupUser(userId);
  }
});

test("서로 다른 글의 동시 댓글도 1분당 10개 제한을 넘기지 않는다", async () => {
  let userId: string | undefined;
  let txA: Promise<PromiseSettledResult<string>> | undefined;
  try {
    userId = await createUser(`rlc${randomUUID().slice(0, 8)}`);
    const postIds = (
      await psql(`
        insert into public.posts (board_id, author_id, kind, title, body)
        values
          (1, ${sqlLiteral(userId)}::uuid, 'text', '동시 댓글 대상 A', '본문'),
          (1, ${sqlLiteral(userId)}::uuid, 'text', '동시 댓글 대상 B', '본문')
        returning id;
      `)
    )
      .split("\n")
      .filter(Boolean);
    const [postA, postB] = postIds;
    expect(postA).toBeDefined();
    expect(postB).toBeDefined();
    await psql(`
      insert into public.comments (post_id, author_id, body)
      select ${postA}, ${sqlLiteral(userId)}::uuid, '기존 댓글 ' || n
      from generate_series(1, 9) n;
    `);

    const applicationName = `ratelimit-comment-${randomUUID()}`;
    txA = settle(authenticatedTransaction(
      applicationName,
      userId,
      `insert into public.comments (post_id, author_id, body) values (${postA}, ${sqlLiteral(userId)}::uuid, '동시 댓글 A');`,
    ));
    await waitForSleepingTransaction(applicationName);
    const txB = settle(authenticatedTransaction(
      `ratelimit-comment-${randomUUID()}`,
      userId,
      `insert into public.comments (post_id, author_id, body) values (${postB}, ${sqlLiteral(userId)}::uuid, '동시 댓글 B');`,
    ));

    const results = await Promise.all([txA, txB]);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(String(rejected[0]?.reason)).toContain("잠시 후 다시 시도해 주세요");
    expect(
      await psql(`select count(*) from public.comments where author_id = ${sqlLiteral(userId)}::uuid;`),
    ).toBe("10");
  } finally {
    if (txA) await txA;
    if (userId) await cleanupUser(userId);
  }
});
