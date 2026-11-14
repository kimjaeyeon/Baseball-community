# Baseball-community

야구 커뮤니티 사이트 프로젝트.

## 로컬 실행

Node.js 22와 Docker Desktop을 사용합니다.

```sh
npm install
npx supabase start
cp .env.example .env.local
```

`npx supabase status`의 API URL과 anon key를 `.env.local`의 두 환경변수에 넣습니다.
로컬 가입은 이메일 확인 없이 바로 로그인됩니다. `.env.local`은 커밋하지 않습니다.

```sh
npm run dev       # http://localhost:3000
npm run build
npm run lint
npm test
npm run test:db
npm run e2e
```

새 마이그레이션 적용: `npx supabase migration up --local`.
DB 테스트는 실행 중인 로컬 Supabase를 대상으로 하며 변경 사항은 롤백합니다.
