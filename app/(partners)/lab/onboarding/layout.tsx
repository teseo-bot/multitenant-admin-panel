// app/(partners)/lab/onboarding/layout.tsx
// Layout para el wizard de onboarding.
//
// No hace el check de onboarded_at (evita loop infinito).
// La página de onboarding ya hace su propio guard.

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
