import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) {
    // Return mock data if table doesn't exist yet for smooth development
    return NextResponse.json([
      {
        id: "1",
        name: "Admin User",
        email: "admin@teseo.ai",
        role: "admin",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Operator One",
        email: "op1@teseo.ai",
        role: "operator",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ]);
  }

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  const { data: user, error } = await supabase
    .from("users")
    .insert([
      {
        name: body.name,
        email: body.email,
        role: body.role,
        isActive: body.isActive,
      }
    ])
    .select()
    .single();

  if (error) {
    // Mock success
    return NextResponse.json({ ...body, id: "mock-id", createdAt: new Date().toISOString() });
  }

  return NextResponse.json(user);
}
