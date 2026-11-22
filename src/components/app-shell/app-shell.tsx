"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const protectedArea =
    pathname.startsWith("/patient/") || pathname.startsWith("/professional/");

  const dashboardHref = pathname.startsWith("/patient/")
    ? "/patient/dashboard"
    : "/professional/dashboard";

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className={styles.headerWrapper}>
        <div className={styles.header}>
          <Link
            className={styles.brand}
            href="/"
            aria-label="Ctrl X · Página inicial"
          >
            <span className={styles.mark} aria-hidden="true">
              x
            </span>
            <span className={styles.brandTitle}>
              Ctrl <span className={styles.brandHighlight}>X</span>
            </span>
            <span className={styles.brandLabel}>Saúde em continuidade</span>
          </Link>

          <nav aria-label="Navegação principal" className={styles.nav}>
            <Link
              className={styles.navLink}
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Início
            </Link>

            {!protectedArea && (
              <>
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
              </>
            )}

            {protectedArea && (
              <Link
                className={styles.navPrimary}
                href={dashboardHref}
                aria-current={pathname.endsWith("/dashboard") ? "page" : undefined}
              >
                Meu espaço
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className={styles.main} id="conteudo" tabIndex={-1}>
        {children}
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