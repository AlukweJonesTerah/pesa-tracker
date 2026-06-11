import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <section className="hero">
      <h1>
        Split bills with friends, <em>without the awkward maths</em>.
      </h1>
      <p>
        Log shared expenses for your trip, house, or chama. Pesa Tracker totals
        everything up and tells each person exactly who to pay — down to the
        shilling.
      </p>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="btn">Start a group — it&apos;s free</button>
        </SignInButton>
      </SignedOut>
    </section>
  );
}
