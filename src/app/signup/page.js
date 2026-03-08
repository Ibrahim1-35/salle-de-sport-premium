"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  }

  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            username: form.username.trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        router.push("/system");
        router.refresh();
        return;
      }

      setMessage("Compte créé. Vérifie ton email pour confirmer l’inscription.");
    } catch (err) {
      console.error(err);
      setError("Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10 text-white">
      <Card className="w-full max-w-md rounded-3xl border-white/10 bg-white/5 text-white shadow-[0_10px_60px_rgba(0,0,0,0.35)]">
        <CardHeader>
          <CardTitle className="text-2xl">Créer un compte</CardTitle>
          <CardDescription className="text-zinc-400">
            Rejoins Gym Premium.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSignup} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Pseudo</Label>
              <Input
                id="username"
                name="username"
                placeholder="tonpseudo"
                value={form.username}
                onChange={handleChange}
                required
                className="border-white/10 bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ton@email.com"
                value={form.email}
                onChange={handleChange}
                required
                className="border-white/10 bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="********"
                value={form.password}
                onChange={handleChange}
                required
                className="border-white/10 bg-zinc-900"
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {message ? <p className="text-sm text-green-400">{message}</p> : null}

            <Button type="submit" disabled={loading} className="w-full rounded-xl">
              {loading ? "Création..." : "Créer mon compte"}
            </Button>

            <div className="flex items-center justify-between text-sm text-zinc-400">
              <Link href="/login" className="hover:text-white">
                Déjà un compte ?
              </Link>
              <Link href="/" className="hover:text-white">
                Retour accueil
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}