import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "신고 안내" };

export default function ReportGuidePage() {
  return <PolicyPage title="신고 안내">
    <p>로그인한 상태에서 글이나 댓글 옆의 <strong>🚩 신고</strong>를 누르고 사유(스팸·욕설·음란·저작권·기타)를 고르면 접수됩니다.</p>
    <p>같은 대상은 한 번만 신고할 수 있습니다. 접수된 신고는 운영자가 확인한 뒤 처리하며, 신고만으로 글이 자동으로 숨겨지지는 않습니다.</p>
    <p>저작권 침해 신고는 원저작물의 주소를 함께 알려 주시면 빠르게 확인할 수 있습니다.</p>
  </PolicyPage>;
}
