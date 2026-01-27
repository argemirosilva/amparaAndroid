#!/bin/bash

# Lista de ícones alternativos
ICONS=("ampara" "workout" "steps" "yoga" "cycle" "beauty" "fashion" "puzzle" "cards" "casual")

# Diretório de destino
DEST_DIR="android/app/src/main/res/mipmap-anydpi-v26"

# Criar pasta se não existir
mkdir -p "$DEST_DIR"

# Gerar XML para cada ícone
for icon in "${ICONS[@]}"; do
  cat > "$DEST_DIR/ic_launcher_$icon.xml" <<EOF
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/white"/>
    <foreground android:drawable="@mipmap/ic_launcher_$icon"/>
</adaptive-icon>
EOF
  echo "✅ Criado: ic_launcher_$icon.xml"
done

echo ""
echo "🎉 Todos os adaptive icons foram criados!"
