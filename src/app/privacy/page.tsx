import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return <PolicyPage title="개인정보처리방침">
    <p>수집 항목: 이메일, 비밀번호(암호화 저장), 닉네임. 글을 읽은 기록은 조회수 중복 방지를 위해 하루 단위로 저장합니다.</p>
    <p>이용 목적: 로그인, 글 작성자 표시, 알림 제공, 도배 방지.</p>
    <p>보관 기간: 회원 탈퇴 시 지체 없이 삭제합니다. 다만 신고 처리 기록은 분쟁 대응을 위해 일정 기간 보관할 수 있습니다.</p>
  </PolicyPage>;
}
