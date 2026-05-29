with open("Dockerfile", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == 'COPY . .':
        new_lines.append(line)
        new_lines.append('COPY .env.production ./\n')
        new_lines.append('COPY start-standalone.js ./\n')
    else:
        new_lines.append(line)

with open("Dockerfile", "w") as f:
    f.writelines(new_lines)
