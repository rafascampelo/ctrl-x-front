import { CareArea } from "@/features/care/care-area";
import { PainDiary } from "@/features/pain/pain-diary";

export const metadata = { title: "Diário de dor" };

export default function PatientPainDiaryPage() {
  return (
    <CareArea
      role="PATIENT"
      title="Diário de dor"
      description="Registre onde e com qual intensidade você sente desconforto para acompanhar sua evolução."
    >
      <PainDiary />
    </CareArea>
  );
}