import ReactMarkdown from "react-markdown";

export default function Markdown({ children }: { children: string }) {
  return <div className="space-y-3 break-words leading-7">
    <ReactMarkdown skipHtml components={{
      a: ({ children, href }) => <a className="text-blue-700 underline" href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
      // Remote images in authored markdown are not part of the upload flow.
      img: ({ alt }) => <span>{alt}</span>,
    }}>{children}</ReactMarkdown>
  </div>;
}
