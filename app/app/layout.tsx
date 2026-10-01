import { ServiceWorker } from "./_components/service-worker";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ServiceWorker />
    </>
  );
}
