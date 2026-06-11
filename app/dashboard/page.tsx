import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { createGroup, joinGroup } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { error } = await searchParams;

  const groups = await sql`
    SELECT g.id, g.name, g.code
    FROM groups g
    JOIN members m ON m.group_id = g.id
    WHERE m.user_id = ${userId}
    ORDER BY g.created_at DESC
  `;

  return (
    <>
      <div className="page-head">
        <h1>My groups</h1>
      </div>

      {error === "code" && (
        <p className="error-note">
          No group matches that code. Check it and try again.
        </p>
      )}

      {groups.length > 0 ? (
        <ul className="group-list">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`}>
                {g.name}
                <span className="group-code">code {g.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty" style={{ marginBottom: 32 }}>
          No groups yet. Create one below, or join with a friend&apos;s code.
        </p>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Create a group</h2>
          <form action={createGroup}>
            <div>
              <label htmlFor="name">Group name</label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Diani trip 2026"
                required
                maxLength={60}
              />
            </div>
            <button className="btn" type="submit">
              Create group
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Join with a code</h2>
          <form action={joinGroup}>
            <div>
              <label htmlFor="code">6-character code</label>
              <input
                id="code"
                name="code"
                type="text"
                placeholder="K7M2PX"
                required
                maxLength={6}
                style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}
              />
            </div>
            <button className="btn btn-outline" type="submit">
              Join group
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
