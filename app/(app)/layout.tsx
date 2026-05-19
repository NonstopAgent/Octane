import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="flex items-center px-4 pt-3 md:hidden">
        <AppSidebar />
      </div>
      <div className="flex">
        <div className="hidden md:block">
          <AppSidebar />
        </div>
        <div className="flex min-h-screen flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
