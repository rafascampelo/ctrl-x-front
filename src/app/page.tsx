import { ApiHealth } from "@/features/system/api-health";
import Link from "next/link";
import ui from "@/components/ui/ui.module.css";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.content}>
        <section className={styles.introduction} aria-labelledby="titulo">
          <div className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            <span>Plataforma de Reabilitação &amp; Fisioterapia</span>
          </div>

          <h1 id="titulo">
            Seu cuidado,<br />
            <span className={styles.highlight}>acompanhado de perto.</span>
          </h1>

          <p className={styles.intro}>
            Cada movimento importa. Registre sua evolução diária, conecte-se ao seu
            fisioterapeuta e acompanhe todo o seu histórico clínico em um só lugar.
          </p>

          <div className={styles.actions}>
            <Link className={[ui.button, styles.primaryAction].join(" ")} href="/login">
              Acessar meu espaço <span aria-hidden="true">→</span>
            </Link>
            <Link className={[ui.button, ui.secondary, styles.secondaryAction].join(" ")} href="/register">
              Criar minha conta
            </Link>
          </div>

          <div className={styles.trustBar}>
            <span>Pacientes &amp; Fisioterapeutas</span>
            <span className={styles.separator} aria-hidden="true">•</span>
            <span>Histórico clínico contínuo</span>
          </div>
        </section>

        <aside className={styles.journey} aria-labelledby="continuidade">
          <div className={styles.journeyHeader}>
            <p className={ui.eyebrow}>Saúde em continuidade</p>
            <h2 id="continuidade">
              Pessoas no centro.<br />
              Cuidado em conexão.
            </h2>
          </div>

          <ol className={styles.steps}>
            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>01</span>
              <div className={styles.stepBody}>
                <h3>Seu próprio espaço</h3>
                <p>Acesso individual seguro, adaptado ao seu perfil clínico.</p>
              </div>
            </li>

            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>02</span>
              <div className={styles.stepBody}>
                <h3>Uma relação de cuidado</h3>
                <p>Ambientes dedicados para pacientes e profissionais vinculados.</p>
              </div>
            </li>

            <li className={styles.stepItem}>
              <span className={styles.stepNumber}>03</span>
              <div className={styles.stepBody}>
                <h3>Histórico em construção</h3>
                <p>Diário de dor, exercícios e evolução terapêutica estruturados.</p>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      <section className={styles.connection} aria-labelledby="conexao">
        <div className={styles.connectionInfo}>
          <p className={ui.eyebrow}>Disponibilidade do sistema</p>
          <h2 id="conexao">Conexão com o serviço</h2>
        </div>
        <ApiHealth />
      </section>
    </div>
  );
}