import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUsers, getUser, createUser, updateUser, deleteUser, getUserActivity } from "@/lib/api/users";
import { UserProfile } from "@/lib/validators/user";

export function useUsers() {
  return useQuery<UserProfile[]>({
    queryKey: ["users"],
    queryFn: getUsers,
  });
}

export function useUser(userId: string) {
  return useQuery<UserProfile>({
    queryKey: ["users", userId],
    queryFn: () => getUser(userId),
    enabled: !!userId,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<UserProfile> }) =>
      updateUser(userId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.userId] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUserActivity(userId: string) {
  return useQuery<any[]>({
    queryKey: ["users", userId, "activity"],
    queryFn: () => getUserActivity(userId),
    enabled: !!userId,
  });
}
