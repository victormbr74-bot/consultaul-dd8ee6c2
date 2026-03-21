interface RichClipboardPayload {
  html: string;
  text: string;
}

export const copyRichTextToClipboard = async ({ html, text }: RichClipboardPayload) => {
  if (navigator.clipboard.write && typeof ClipboardItem !== "undefined") {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([text], { type: "text/plain" });
    await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })]);
    return;
  }

  await navigator.clipboard.writeText(text);
};
