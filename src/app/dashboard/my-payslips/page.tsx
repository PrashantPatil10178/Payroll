import PageContainer from "@/components/layout/page-container";
import { MyPayslipsView } from "@/features/teacher-portal/components/my-payslips-view";
import { api } from "@/trpc/server";

export const metadata = { title: "My Payslips" };

export default async function MyPayslipsPage() {
	const [profile, payslips] = await Promise.all([
		api.efms.myTeacherProfile(),
		api.efms.myPayslips(),
	]);

	return (
		<PageContainer
			pageTitle="My Payslips"
			pageDescription="Your monthly payroll history."
		>
			<MyPayslipsView profile={profile} payslips={payslips} />
		</PageContainer>
	);
}
