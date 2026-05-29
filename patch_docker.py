with open("Dockerfile", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith("ARG NEXT_PUBLIC_SUPABASE_URL") and "runner" in "".join(new_lines[-10:]):
        continue
    if line.startswith("ARG NEXT_PUBLIC_SUPABASE_ANON_KEY") and "runner" in "".join(new_lines[-10:]):
        continue
    if line.startswith("ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL") and "runner" in "".join(new_lines[-10:]):
        continue
    if line.startswith("ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY") and "runner" in "".join(new_lines[-10:]):
        continue
    if line.startswith("ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_…_KEY") or line.startswith("ENV SUPABASE_SERVICE_ROLE_KEY=$SUPAB…_KEY"):
        continue
    
    new_lines.append(line)

with open("Dockerfile", "w") as f:
    f.writelines(new_lines)
