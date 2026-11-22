import { CareArea } from "@/features/care/care-area";
import { PatientPrescriptions } from "@/features/prescriptions/patient-prescriptions";

export const metadata = { title: "Meus exercícios" };

export default function PatientExercisesPage() {
  return (
    <CareArea
      role="PATIENT"
      title="Exercícios prescritos"
      description="Consulte suas rotinas de reabilitação e registre cada treino realizado."
    >
      <PatientPrescriptions />
    </CareArea>
  );
}