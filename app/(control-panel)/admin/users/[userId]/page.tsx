"use client"

import { UserForm } from "@/components/user-management/user-form"
import { useUser, useUpdateUser } from "@/hooks/use-users"
import { UserFormValues } from "@/lib/validators/user"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { use } from "react"

export default function EditUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter()
  const { userId } = use(params)
  
  const { data: user, isLoading, isError } = useUser(userId)
  const { mutate: updateUser, isPending } = useUpdateUser()

  const onSubmit = (data: UserFormValues) => {
    updateUser({ userId, data }, {
      onSuccess: () => {
        toast.success("User updated successfully")
        router.push("/admin/users")
      },
      onError: () => {
        toast.error("Failed to update user")
      }
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6 max-w-2xl">
        <Skeleton className="h-10 w-[200px]" />
        <div className="space-y-8 mt-8">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  if (isError || !user) {
    return <div className="p-8 text-red-500">Failed to load user.</div>
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-2xl">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" render={<Link href="/admin/users" />}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Edit User</h2>
      </div>
      
      <div className="mt-8">
        <UserForm initialData={user} onSubmit={onSubmit} isLoading={isPending} />
      </div>
    </div>
  )
}
