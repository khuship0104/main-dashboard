import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = typeof searchParams.next === "string" ? searchParams.next : "/";
  return (
    <div className="login">
      <div className="card">
        <div>
          <h1>Khushi<span style={{ color: "var(--accent)" }}>.</span></h1>
          <p className="muted" style={{ marginTop: 6 }}>Enter your password to open your dashboard.</p>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
