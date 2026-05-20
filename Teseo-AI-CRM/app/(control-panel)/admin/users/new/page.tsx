"use client"

import { UserForm } from "@/components/user-management/user-form"
import { useCreateUser } from "@/hooks/use-users"
import { UserFormValues } from "@/lib/validators/user"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NewUserPage() {
  const router = useRouter()
  const { mutate: createUser, isPending } = useCreateUser()

  const onSubmit = (data: UserFormValues) => {
    createUser(data, {
      onSuccess: () => {
        toast.success("User created successfully")
        router.push("/admin/users")
      },
      onError: () => {
        toast.error("Failed to create user")
      }
    })
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-2xl">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" render={<Link href="/admin/users" />}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Add User</h2>
      </div>
      
      <div className="mt-8">
        <UserForm onSubmit={onSubmit} isLoading={isPending} />
      </div>
    </div>
  )
}
