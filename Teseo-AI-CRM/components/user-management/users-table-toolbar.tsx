"use client"

import { Table } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { Plus } from "lucide-react"
import Link from "next/link"

interface UsersTableToolbarProps<TData> {
  table: Table<TData>
}

export function UsersTableToolbar<TData>({
  table,
}: UsersTableToolbarProps<TData>) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Filter users..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="h-8 w-[150px] lg:w-[250px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Link href="/admin/users/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Link>
      </div>
    </div>
  )
}
