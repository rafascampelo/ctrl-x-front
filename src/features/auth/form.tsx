"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  authRequest,
  credentialsSchema,
  dashboardPath,
  registrationSchema,
} from "./auth";
import styles from "./form.module.css";
import { Button } from "@/components/ui/button";
import { ContentState } from "@/components/ui/content-state";
import ui from "@/components/ui/ui.module.css";

type Values = z.input<typeof registrationSchema>;

export function AuthForm({ register: isRegister }: { register: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const session = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => authRequest("me"),
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (session.data) router.replace(dashboardPath(session.data.role));
  }, [router, session.data]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(
      isRegister ? registrationSchema : credentialsSchema,
    ) as never,
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      confirmation: "",
      role: "PATIENT",
    },
  });

  const selectedRole = useWatch({ control, name: "role" });
  const professional = selectedRole === "PROFESSIONAL";

  async function submit(values: Values) {
    setMessage("");
    try {
      if (isRegister) {
        await authRequest("register", {
          email: values.email.trim().toLowerCase(),
          password: values.password,
          full_name: values.full_name.trim(),
          role: values.role,
          ...(values.role === "PROFESSIONAL"
            ? {
                crefito_region: values.crefito_region,
                crefito_number: values.crefito_number?.trim(),
              }
            : {}),
        });
        router.push("/login?registered=1");
      } else {
        const user = await authRequest("login", {
          email: values.email.trim().toLowerCase(),
          password: values.password,
        });
        queryClient.clear();
        router.replace(dashboardPath(user.role));
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Erro de conexão com o serviço.",
      );
    }
  }

  if (session.isPending || session.data) {
    return (
      <ContentState kind="loading" title="Verificando sua sessão">
        <p>Aguarde para acessar seu espaço.</p>
      </ContentState>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.header}>
          <p className={ui.eyebrow}>
            {isRegister ? "Comece pelo seu acesso" : "Seu espaço de cuidado"}
          </p>
          <h1>{isRegister ? "Criar sua conta" : "Que bom ter você aqui."}</h1>
          <p className={styles.intro}>
            {isRegister
              ? "Preencha seus dados e selecione seu perfil para iniciar no Ctrl X."
              : "Entre com suas credenciais para acompanhar seu histórico."}
          </p>
        </div>

        {params.get("registered") && (
          <p className={styles.statusBanner} role="status">
            Cadastro concluído com sucesso. Entre abaixo para acessar sua conta.
          </p>
        )}

        {params.get("expired") && (
          <p className={styles.statusBanner} role="status">
            Sua sessão expirou ou você ainda não entrou. Entre novamente.
          </p>
        )}

        {message && (
          <p className={styles.errorBanner} role="alert">
            {message}
          </p>
        )}

        <form
          className={styles.form}
          onSubmit={handleSubmit(submit)}
          noValidate
          aria-busy={isSubmitting}
        >
          {isRegister && (
            <>
              <div className={styles.field}>
                <span className={styles.label}>Como você vai usar o Ctrl X?</span>
                <input type="hidden" {...register("role")} />
                <div
                  className={styles.roleGrid}
                  role="radiogroup"
                  aria-label="Perfil de acesso"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === "PATIENT"}
                    className={[
                      styles.roleOption,
                      selectedRole === "PATIENT" ? styles.roleActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("role", "PATIENT", { shouldValidate: true })
                    }
                  >
                    <span className={styles.roleTitle}>Sou Paciente</span>
                    <span className={styles.roleDesc}>
                      Registrar dor e acompanhar exercícios
                    </span>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === "PROFESSIONAL"}
                    className={[
                      styles.roleOption,
                      selectedRole === "PROFESSIONAL" ? styles.roleActive : "",
                    ].join(" ")}
                    onClick={() =>
                      setValue("role", "PROFESSIONAL", { shouldValidate: true })
                    }
                  >
                    <span className={styles.roleTitle}>Sou Fisioterapeuta</span>
                    <span className={styles.roleDesc}>
                      Acompanhar pacientes e prescrições
                    </span>
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="full_name">
                  Nome completo
                </label>
                <input
                  id="full_name"
                  placeholder="Ex: Maria Clara Santos"
                  autoComplete="name"
                  aria-invalid={!!errors.full_name}
                  aria-describedby="name-error"
                  {...register("full_name")}
                />
                <span className={styles.errorText} id="name-error">
                  {errors.full_name?.message}
                </span>
              </div>

              {professional && (
                <div className={styles.professionalBox}>
                  <p className={styles.boxTitle}>Registro Profissional</p>
                  <div className={styles.crefitoGrid}>
                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor="register-crefito-region"
                      >
                        Região CREFITO
                      </label>
                      <input
                        id="register-crefito-region"
                        type="number"
                        placeholder="Ex: 3"
                        min={1}
                        max={22}
                        required
                        aria-invalid={!!errors.crefito_region}
                        aria-describedby="register-region-error"
                        {...register("crefito_region", {
                          setValueAs: (value: string) =>
                            value === "" ? undefined : Number(value),
                        })}
                      />
                      <span
                        className={styles.errorText}
                        id="register-region-error"
                      >
                        {errors.crefito_region?.message}
                      </span>
                    </div>

                    <div className={styles.field}>
                      <label
                        className={styles.label}
                        htmlFor="register-crefito-number"
                      >
                        Número CREFITO
                      </label>
                      <input
                        id="register-crefito-number"
                        placeholder="12345-F"
                        maxLength={20}
                        required
                        aria-invalid={!!errors.crefito_number}
                        aria-describedby="register-number-error register-verification-hint"
                        {...register("crefito_number")}
                      />
                      <span
                        className={styles.errorText}
                        id="register-number-error"
                      >
                        {errors.crefito_number?.message}
                      </span>
                    </div>
                  </div>
                  <p id="register-verification-hint" className={styles.hint}>
                    O registro será enviado ao serviço. O acesso profissional
                    depende da verificação.
                  </p>
                </div>
              )}
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              placeholder="voce@exemplo.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              aria-describedby="email-error"
              {...register("email")}
            />
            <span className={styles.errorText} id="email-error">
              {errors.email?.message}
            </span>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="password">
                Senha
              </label>
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={
                isRegister ? "Mínimo de 12 caracteres" : "Digite sua senha"
              }
              autoComplete={isRegister ? "new-password" : "current-password"}
              aria-invalid={!!errors.password}
              aria-describedby={
                isRegister ? "password-hint password-error" : "password-error"
              }
              {...register("password")}
            />
            <span className={styles.errorText} id="password-error">
              {errors.password?.message}
            </span>
            {isRegister && (
              <p id="password-hint" className={styles.hint}>
                Use entre 12 e 128 caracteres para proteger seus dados clínicos.
              </p>
            )}
          </div>

          {isRegister && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirmation">
                Confirme a senha
              </label>
              <input
                id="confirmation"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha escolhida"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmation}
                aria-describedby="confirmation-error"
                {...register("confirmation")}
              />
              <span className={styles.errorText} id="confirmation-error">
                {errors.confirmation?.message}
              </span>
            </div>
          )}

          <Button className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting
              ? "Aguarde…"
              : isRegister
                ? "Criar minha conta"
                : "Entrar no meu espaço"}
          </Button>
        </form>

        <div className={styles.footerSwitch}>
          <span>
            {isRegister ? "Já possui uma conta?" : "Ainda não tem cadastro?"}
          </span>
          <Link href={isRegister ? "/login" : "/register"}>
            {isRegister ? "Entrar agora" : "Criar conta gratuita"}
          </Link>
        </div>
      </div>
    </div>
  );
}