import { CareArea } from "@/features/care/care-area";
import { PatientClinicalRecords } from "@/features/clinical-records/patient-clinical-records";

export const metadata = { title: "Meus prontuários" };

export default function PatientRecordsPage() {
  return (
    <CareArea
      role="PATIENT"
      title="Prontuários clínicos"
      description="Consulte suas avaliações fisioterapêuticas finalizadas, planos de cuidado e adendos registrados."
    >
      <PatientClinicalRecords />
    </CareArea>
  );
}