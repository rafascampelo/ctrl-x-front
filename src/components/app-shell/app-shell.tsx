"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { authRequest, dashboardPath } from "@/features/auth/auth";
import { LogoutButton } from "@/features/auth/logout-button";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const protectedArea =
    pathname.startsWith("/patient/") || pathname.startsWith("/professional/");

  const dashboardHref = pathname.startsWith("/patient/")
    ? "/patient/dashboard"
    : "/professional/dashboard";
  const patient = pathname.startsWith("/patient/");
  const professionalPatientRoute = !patient
    ? pathname.match(/^\/professional\/patients\/([^/]+)(?:\/(?:records|prescriptions|documents))?\/?$/)
    : null;
  const backHref = professionalPatientRoute
    ? professionalPatientRoute[0].includes("/records") ||
      professionalPatientRoute[0].includes("/prescriptions") ||
      professionalPatientRoute[0].includes("/documents")
      ? `/professional/patients/${professionalPatientRoute[1]}`
      : "/professional/patients"
    : null;
  const backLabel = backHref?.includes("/patients/")
    ? "Voltar para ficha do paciente"
    : "Voltar para meus pacientes";
  const workspaceSession = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authRequest("me"),
    enabled: protectedArea || pathname === "/",
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const validWorkspace =
    protectedArea &&
    workspaceSession.data?.role === (patient ? "PATIENT" : "PROFESSIONAL");

  useEffect(() => {
    if (pathname === "/" && workspaceSession.data) {
      router.replace(dashboardPath(workspaceSession.data.role));
    }
  }, [pathname, workspaceSession.data, router]);
  const workspaceLinks = patient
    ? [
        { href: "/patient/dashboard", label: "Visão geral" },
        { href: "/patient/pain-diary", label: "Diário de dor" },
        { href: "/patient/timeline", label: "Histórico" },
        { href: "/patient/exercises", label: "Exercícios" },
        { href: "/patient/records", label: "Prontuários" },
        { href: "/patient/physiotherapist", label: "Fisioterapeuta" },
        { href: "/patient/documents", label: "Documentos" },
      ]
    : [
        { href: "/professional/dashboard", label: "Visão geral" },
        { href: "/professional/patients", label: "Pacientes" },
        { href: "/professional/profile", label: "Meu perfil" },
      ];

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className={styles.headerWrapper}>
        <div className={styles.header}>
          <Link
            className={styles.brand}
            href={protectedArea ? dashboardHref : "/"}
            aria-label={protectedArea ? "Ctrl X · Área de cuidado" : "Ctrl X · Página inicial"}
          >
            <span className={styles.mark} aria-hidden="true">
              x
            </span>
            <span className={styles.brandTitle}>
              Ctrl <span className={styles.brandHighlight}>X</span>
            </span>
            <span className={styles.brandLabel}>Saúde em continuidade</span>
          </Link>

          {!protectedArea ? (
            <nav aria-label="Navegação principal" className={styles.nav}>
              <Link className={styles.navLink} href="/" aria-current={pathname === "/" ? "page" : undefined}>
                Início
              </Link>
              <Link
                className={styles.navSecondary}
                href="/login"
                aria-current={pathname === "/login" ? "page" : undefined}
              >
                Entrar
              </Link>
              <Link
                className={styles.navPrimary}
                href="/register"
                aria-current={pathname === "/register" ? "page" : undefined}
              >
                Criar conta
              </Link>
            </nav>
          ) : validWorkspace ? (
            <div className={styles.workspaceActions}>
              <span className={styles.workspaceLabel}>
                {patient ? "Área do paciente" : "Área do fisioterapeuta"}
              </span>
              <LogoutButton />
            </div>
          ) : null}
        </div>
        {validWorkspace && (
          <nav aria-label={patient ? "Menu da área do paciente" : "Menu da área do fisioterapeuta"} className={styles.workspaceNav}>
            <div className={styles.workspaceLinks}>
              {workspaceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.workspaceLink}
                  aria-current={pathname === item.href ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
        {validWorkspace && backHref && (
          <div className={styles.backRow}>
            <Button
              type="button"
              variant="secondary"
              className={styles.backButton}
              aria-label={backLabel}
              title={backLabel}
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.replace(backHref);
              }}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </Button>
          </div>
        )}
      </header>

      <main className={styles.main} id="conteudo" tabIndex={-1}>
        {pathname === "/" && workspaceSession.isPending ? (
          <p className={styles.sessionCheck} role="status">
            Verificando seu espaço de cuidado…
          </p>
        ) : children}
      </main>

      <footer className={styles.footerWrapper}>
        <div className={styles.footer}>
          <span className={styles.footerBrand}>
            <strong>Ctrl X</strong> · Acompanhamento de saúde e reabilitação
          </span>
          <span className={styles.footerBadge}>Ambiente de desenvolvimento</span>
        </div>
      </footer>
    </div>
  );
}
