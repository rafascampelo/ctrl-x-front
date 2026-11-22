"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentState } from "@/components/ui/content-state";
import { LogoutButton } from "./logout-button";
import { getAllLinks, getPatients, getProfile } from "@/services/care";
import ui from "@/components/ui/ui.module.css";
import styles from "./dashboard.module.css";
import { authRequest, AuthError, dashboardPath, type User } from "./auth";

export function Dashboard({ role }: { role: User["role"] }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const session = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authRequest("me"),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (session.error instanceof AuthError && session.error.status === 401) {
      router.replace("/login?expired=1");
    } else if (session.data && session.data.role !== role) {
      router.replace(dashboardPath(session.data.role));
    }
  }, [session.data, session.error, role, router]);

  const userId = session.data?.id;
  const isValidRole = session.data?.role === role;

  const profile = useQuery({
    queryKey: ["care", userId, "profile"],
    queryFn: ({ signal }) => getProfile(userId!, role, signal),
    enabled: !!userId && isValidRole,
    gcTime: 0,
  });

  const links = useQuery({
    queryKey: ["care", userId, "links"],
    queryFn: ({ signal }) => getAllLinks(signal),
    enabled: !!userId && isValidRole,
    gcTime: 0,
  });

  const isVerifiedProfessional =
    profile.data?.role === "PROFESSIONAL" &&
    profile.data.verification_status === "verified";

  const patientsQuery = useQuery({
    queryKey: ["care", userId, "patients-preview"],
    queryFn: ({ signal }) => getPatients(undefined, signal),
    enabled: !!userId && isVerifiedProfessional,
    gcTime: 0,
  });

  if (
    session.isPending ||
    (session.error instanceof AuthError && session.error.status === 401) ||
    (session.data && session.data.role !== role)
  ) {
    return (
      <ContentState kind="loading" title="Verificando sua sessão">
        <p>Estamos preparando seu espaço de cuidado.</p>
      </ContentState>
    );
  }

  if (session.isError) {
    return (
      <ContentState
        kind="error"
        title="Não foi possível verificar sua sessão"
      >
        <p>Confira sua conexão e tente novamente.</p>
        <Button
          disabled={session.isFetching}
          onClick={() => void session.refetch()}
        >
          {session.isFetching ? "Verificando…" : "Tentar novamente"}
        </Button>
      </ContentState>
    );
  }

  const patient = role === "PATIENT";
  const firstName = profile.data?.full_name
    ? profile.data.full_name.trim().split(/\s+/)[0]
    : null;

  const activeLinks =
    links.data?.filter((link) => link.status === "active") ?? [];
  const pendingLinks =
    links.data?.filter((link) => link.status === "pending") ?? [];

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  }

  return (
    <section className={styles.page} aria-labelledby="dashboard-title">
      <nav className={styles.subNav} aria-label="Navegação do espaço">
        <Link
          href={patient ? "/patient/dashboard" : "/professional/dashboard"}
          aria-current="page"
        >
          Visão geral
        </Link>
        {patient && (
          <>
            <Link href="/patient/pain-diary">Diário de dor</Link>
            <Link href="/patient/timeline">Calendário</Link>
            <Link href="/patient/exercises">Exercícios</Link>
            <Link href="/patient/records">Prontuários</Link>
            <Link href="/patient/documents">Documentos</Link>
          </>
        )}
        <Link
          href={
            patient ? "/patient/physiotherapist" : "/professional/patients"
          }
        >
          {patient ? "Meu fisioterapeuta" : "Meus pacientes"}
        </Link>
        <Link href={patient ? "/patient/profile" : "/professional/profile"}>
          Meu perfil
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <p className={ui.eyebrow}>Meu espaço · Ctrl X</p>
          <h1 id="dashboard-title">
            {firstName
              ? `Olá, ${firstName}.`
              : patient
                ? "Seu cuidado começa aqui."
                : "Um espaço para acompanhar."}
          </h1>
          <p className={styles.subtitle}>
            {patient
              ? "Acompanhe seu vínculo terapêutico, registre sua evolução diária e acesse seu histórico clínico."
              : "Gerencie seus pacientes vinculados, elabore prontuários clínicos e prescreva rotinas de exercícios."}
          </p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.roleBadge}>
            {patient ? "Área do paciente" : "Área do fisioterapeuta"}
          </span>
          <LogoutButton />
        </div>
      </header>

      <div className={styles.metricsGrid}>
        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {patient ? "Acompanhamento ativo" : "Pacientes ativos"}
          </span>
          <strong className={styles.metricValue}>
            {links.isPending
              ? "—"
              : patient
                ? activeLinks.length > 0
                  ? "Conectado"
                  : "Sem vínculo"
                : activeLinks.length}
          </strong>
          <span className={styles.metricHint}>
            {patient
              ? activeLinks.length > 0
                ? "Fisioterapeuta autorizado"
                : "Conecte-se usando o código do profissional"
              : activeLinks.length === 1
                ? "1 paciente em acompanhamento"
                : `${activeLinks.length} pacientes vinculados`}
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>Solicitações pendentes</span>
          <strong className={styles.metricValue}>
            {links.isPending ? "—" : pendingLinks.length}
          </strong>
          <span className={styles.metricHint}>
            {pendingLinks.length > 0
              ? patient
                ? "Aguardando aceite do fisioterapeuta"
                : "Novos pedidos aguardando sua resposta"
              : "Nenhuma pendência no momento"}
          </span>
        </article>

        <article className={styles.metricCard}>
          <span className={styles.metricLabel}>
            {patient ? "Status do cadastro" : "Registro profissional"}
          </span>
          <strong className={styles.metricValue}>
            {profile.isPending
              ? "—"
              : patient
                ? "Ativo"
                : isVerifiedProfessional
                  ? "Verificado"
                  : "Em análise"}
          </strong>
          <span className={styles.metricHint}>
            {profile.data?.role === "PROFESSIONAL" &&
            profile.data.crefito_region &&
            profile.data.crefito_number
              ? `CREFITO-${profile.data.crefito_region} · ${profile.data.crefito_number}`
              : session.data.email}
          </span>
        </article>
      </div>

      <div className={styles.layout}>
        <div className={styles.primaryColumn}>
          {!patient &&
            profile.data?.role === "PROFESSIONAL" &&
            profile.data.verification_status === "unverified" && (
              <div className={styles.alertCard} role="status">
                <div>
                  <h2>Verificação profissional pendente</h2>
                  <p>
                    Seu registro CREFITO ainda está aguardando validação pelo
                    serviço. Assim que aprovado, você poderá aceitar pacientes e
                    iniciar acompanhamentos.
                  </p>
                </div>
                <Link
                  href="/professional/profile"
                  className={[ui.button, ui.secondary].join(" ")}
                >
                  Conferir meu CREFITO
                </Link>
              </div>
            )}

          <section
            className={styles.surface}
            aria-labelledby="care-status-title"
          >
            <div className={styles.surfaceHeader}>
              <div>
                <p className={ui.eyebrow}>
                  {patient ? "Relação de cuidado" : "Carteira de pacientes"}
                </p>
                <h2 id="care-status-title">
                  {patient
                    ? "Seu fisioterapeuta"
                    : "Pacientes em acompanhamento"}
                </h2>
              </div>
              <Link
                href={
                  patient
                    ? "/patient/physiotherapist"
                    : "/professional/patients"
                }
                className={ui.button}
              >
                {patient
                  ? activeLinks.length > 0
                    ? "Gerenciar vínculo"
                    : "Conectar fisioterapeuta"
                  : "Abrir meus pacientes"}
              </Link>
            </div>

            {patient ? (
              activeLinks.length > 0 ? (
                <div className={styles.statusBox}>
                  <span className={styles.statusPillActive}>Vínculo ativo</span>
                  <p className={styles.statusText}>
                    Você possui um fisioterapeuta autorizado para acompanhar sua
                    evolução clínica.
                  </p>
                  <div className={styles.codeRow}>
                    <span className={styles.codeLabel}>
                      Código do profissional:
                    </span>
                    <code className={styles.inlineCode}>
                      {activeLinks[0].professional_id}
                    </code>
                  </div>
                </div>
              ) : (
                <div className={styles.emptyBox}>
                  <p>
                    Você ainda não está vinculado a nenhum fisioterapeuta. Peça o{" "}
                    <strong>código de vínculo</strong> ao seu profissional e
                    envie uma solicitação para iniciar seu acompanhamento.
                  </p>
                </div>
              )
            ) : patientsQuery.data?.items.length ? (
              <ul className={styles.patientList}>
                {patientsQuery.data.items.slice(0, 4).map((p) => (
                  <li key={p.id} className={styles.patientRow}>
                    <div>
                      <strong>{p.full_name}</strong>
                      <span>Paciente vinculado</span>
                    </div>
                    <Link
                      href={`/professional/patients/${p.id}`}
                      className={[ui.button, ui.secondary, styles.smallBtn].join(
                        " ",
                      )}
                    >
                      Abrir atendimento
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.emptyBox}>
                <p>
                  {pendingLinks.length > 0
                    ? `Você tem ${pendingLinks.length} solicitação(ões) aguardando resposta na aba Meus pacientes.`
                    : "Nenhum paciente ativo no momento. Compartilhe seu código de vínculo para receber solicitações."}
                </p>
              </div>
            )}
          </section>

          <section className={styles.surface} aria-labelledby="roadmap-title">
            <p className={ui.eyebrow}>Acesso rápido</p>
            <h2 id="roadmap-title">Módulos clínicos do Ctrl X</h2>
            <p className={styles.mutedText}>
              Acesse diretamente qualquer ferramenta do seu acompanhamento:
            </p>
            <div className={styles.modulesGrid}>
              <Link
                href={
                  patient ? "/patient/pain-diary" : "/professional/patients"
                }
                className={styles.moduleItem}
                style={{ textDecoration: "none" }}
              >
                <span className={styles.moduleTag}>Módulo 04 · Dor</span>
                <h3>
                  {patient ? "Diário de Dor (EVA)" : "Prontuários Clínicos"}
                </h3>
                <p>
                  {patient
                    ? "Registre intensidade de 0 a 10 e região corporal."
                    : "Avaliações estruturadas, rascunhos e adendos."}
                </p>
              </Link>

              <Link
                href={
                  patient ? "/patient/exercises" : "/professional/patients"
                }
                className={styles.moduleItem}
                style={{ textDecoration: "none" }}
              >
                <span className={styles.moduleTag}>Módulo 07 · Reabilitação</span>
                <h3>
                  {patient ? "Exercícios Prescritos" : "Prescrição de Rotinas"}
                </h3>
                <p>
                  {patient
                    ? "Consulte séries, repetições e marque treinos concluídos."
                    : "Monte treinos personalizados para pacientes ativos."}
                </p>
              </Link>

              <Link
                href={
                  patient ? "/patient/documents" : "/professional/patients"
                }
                className={styles.moduleItem}
                style={{ textDecoration: "none" }}
              >
                <span className={styles.moduleTag}>Módulo 09 · OCR</span>
                <h3>Documentos &amp; Exames</h3>
                <p>
                  Envio privado de laudos e validação humana do texto extraído.
                </p>
              </Link>
            </div>
          </section>
        </div>

        <aside className={styles.account} aria-labelledby="account-title">
          <div className={styles.accountHeader}>
            <div className={styles.avatar} aria-hidden="true">
              {(firstName?.[0] ?? session.data.email[0]).toUpperCase()}
            </div>
            <div>
              <h2 id="account-title">
                {profile.data?.full_name || "Sua conta"}
              </h2>
              <span className={styles.accountRole}>
                {patient ? "Paciente" : "Fisioterapeuta"}
              </span>
            </div>
          </div>

          <dl className={styles.accountList}>
            <dt>E-mail cadastrado</dt>
            <dd>{session.data.email}</dd>

            {profile.data?.role === "PROFESSIONAL" && (
              <>
                <dt>Código para vínculo</dt>
                <dd className={styles.copyBox}>
                  <code className={styles.code}>{profile.data.id}</code>
                  <button
                    type="button"
                    className={styles.copyButton}
                    onClick={() => void copyCode(profile.data!.id)}
                  >
                    {copied ? "Copiado!" : "Copiar código"}
                  </button>
                </dd>
              </>
            )}
          </dl>

          <nav aria-label="Atalhos da conta" className={styles.links}>
            <Link
              href={patient ? "/patient/profile" : "/professional/profile"}
              className={[ui.button, ui.secondary].join(" ")}
            >
              Editar meu perfil
            </Link>
            <Link
              href={
                patient
                  ? "/patient/physiotherapist"
                  : "/professional/patients"
              }
              className={[ui.button, ui.secondary].join(" ")}
            >
              {patient ? "Gerenciar fisioterapeuta" : "Gerenciar pacientes"}
            </Link>
          </nav>
        </aside>
      </div>
    </section>
  );
}