import RegistrationForm from "./registration-form";

export default async function PublicRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RegistrationForm token={token} />;
}
