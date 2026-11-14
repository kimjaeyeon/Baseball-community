import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "이용약관" };

export default function TermsPage() {
  return <PolicyPage title="이용약관">
    <p>이 사이트는 야구 팬이 글과 링크를 나누는 커뮤니티입니다. 가입한 이용자는 글·댓글·추천·신고 기능을 쓸 수 있습니다.</p>
    <p>다른 사람의 저작물을 무단으로 올리거나, 욕설·광고·도배로 다른 이용자를 방해하면 글이 삭제되거나 이용이 제한될 수 있습니다.</p>
    <p>글의 저작권은 작성자에게 있으며, 작성자는 사이트에 글을 보여 줄 권한을 사이트에 허락합니다.</p>
  </PolicyPage>;
}
