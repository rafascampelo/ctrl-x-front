import { CareArea } from "@/features/care/care-area";
import { PatientTimeline } from "@/features/timeline/patient-timeline";

export const metadata = { title: "Calendário e histórico" };

export default function PatientTimelinePage() {
  return (
    <CareArea
      role="PATIENT"
      title="Calendário e linha do tempo"
      description="Visualize seus registros por data e acompanhe a continuidade do seu tratamento."
    >
      <PatientTimeline />
    </CareArea>
  );
}