import "./globals.css";

export const metadata = {
  title: "Gym Premium",
  description: "Système premium de programmation et suivi musculation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>
        <div className="app-shell">
          <div className="app-bg-gradient" />
          <div className="app-bg-grid" />
          <div className="app-noise" />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}