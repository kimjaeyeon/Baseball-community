import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "청소년보호정책" };

export default function YouthPage() {
  return <PolicyPage title="청소년보호정책">
    <p>청소년에게 유해한 음란·폭력·도박 관련 글은 올릴 수 없습니다. 이런 글은 신고를 받아 확인 후 삭제합니다.</p>
    <p>유해한 글을 발견하면 글 아래 <strong>🚩 신고</strong> 버튼으로 알려 주세요.</p>
  </PolicyPage>;
}
