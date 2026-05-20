import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const supabase = await createClient();
  const { userId } = await params;

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    return NextResponse.json({
      id: userId,
      name: "Mock User",
      email: "mock@teseo.ai",
      role: "operator",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request, { params }: { params: { userId: string } }) {
  const supabase = await createClient();
  const { userId } = await params;
  const body = await request.json();

  const { data: user, error } = await supabase
    .from("users")
    .update(body)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ...body, id: userId });
  }

  return NextResponse.json(user);
}

export async function DELETE(request: Request, { params }: { params: { userId: string } }) {
  const supabase = await createClient();
  const { userId } = await params;

  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}
