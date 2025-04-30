
export default function GradientBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-radial from-unfold-purple/5 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-20 left-10 w-64 h-64 bg-unfold-purple/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-unfold-teal/10 rounded-full blur-3xl pointer-events-none -z-10" />
      {children}
    </div>
  );
}
