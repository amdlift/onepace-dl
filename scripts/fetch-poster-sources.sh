#!/usr/bin/env bash
# The project owner's Drive folder offers no stable direct URLs, so the file ids are recorded
# rather than discovered: https://drive.google.com/drive/folders/1xBpknfU8P6ZNN1L0Sp1y4-tG3Z9ThdIw
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sources="$root/artwork-sources"
mkdir -p "$sources"

node -e 'for (const f of require(process.argv[1])) console.log(f.id + "\t" + f.name)' \
	"$root/scripts/poster-sources.json" |
	while IFS=$'\t' read -r id name; do
		if [ -s "$sources/$name" ]; then
			echo "have $name"
			continue
		fi
		curl -fsSL --retry 3 -A 'Mozilla/5.0' \
			"https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t" \
			-o "$sources/$name"
		echo "got  $name"
	done
