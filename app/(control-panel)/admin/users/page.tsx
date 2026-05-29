"use client"

import { useUsers } from "@/hooks/use-users"
import { UsersTable } from "@/components/user-management/users-table"
import { columns } from "@/components/user-management/users-table-columns"
import { Skeleton } from "@/components/ui/skeleton"

export default function UsersPage() {
  const { data: users, isLoading, isError } = useUsers()

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Users</h2>
      </div>
      
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-[250px]" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : isError ? (
        <div className="text-red-500">Failed to load users.</div>
      ) : (
        <UsersTable columns={columns} data={users || []} />
      )}
    </div>
  )
}
