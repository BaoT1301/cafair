import { Logo } from "@/components/ui/logo";
import { ClerkLoaded, ClerkLoading, SignUp } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

const SignUpPage = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div className="h-full lg:flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4 pt-16">
          <h1 className="font-bold text-3xl text-primary">Welcome Back!</h1>
          <p className="text-base text-muted-foreground">
            Log In or Create to get back to your dashboard
          </p>
          <div className="flex items-center justify-center mt-8">
            <ClerkLoaded>
              <SignUp path="/sign-up" />
            </ClerkLoaded>
            <ClerkLoading>
              <Loader2 className="animate-spin text-muted-foreground" />
            </ClerkLoading>
          </div>
        </div>
      </div>
      <div className="h-full hidden lg:flex items-center justify-center bg-primary">
        <Logo />
      </div>
    </div>
  );
};

export default SignUpPage;
