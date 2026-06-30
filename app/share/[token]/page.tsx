import ShareDownload from "../../components/ShareDownload";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  return <ShareDownload token={token} />;
}
