#!/usr/bin/env python3
"""
Script para gerar ícones do Android em múltiplas resoluções
"""
import subprocess
import os

# Definir os ícones e seus nomes
icons = {
    'ampara': 'icon_ampara_original.png',
    'workout': 'icon_fitness_workout.png',
    'steps': 'icon_fitness_steps.png',
    'yoga': 'icon_fitness_yoga.png',
    'cycle': 'icon_feminine_cycle.png',
    'beauty': 'icon_feminine_beauty.png',
    'fashion': 'icon_feminine_fashion.png',
    'puzzle': 'icon_game_puzzle.png',
    'cards': 'icon_game_cards.png',
    'casual': 'icon_game_casual.png',
}

# Resoluções do Android
resolutions = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

base_dir = '/home/ubuntu/amparamobile'
android_res = f'{base_dir}/android/app/src/main/res'

print("🎨 Gerando ícones em múltiplas resoluções...\n")

for icon_name, icon_file in icons.items():
    source = f'{base_dir}/{icon_file}'
    
    if not os.path.exists(source):
        print(f"❌ Arquivo não encontrado: {source}")
        continue
    
    print(f"📱 Processando: {icon_name}")
    
    for res_folder, size in resolutions.items():
        output_dir = f'{android_res}/{res_folder}'
        output_file = f'{output_dir}/ic_launcher_{icon_name}.png'
        
        # Redimensionar usando ImageMagick
        cmd = f'convert "{source}" -resize {size}x{size} "{output_file}"'
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"  ✅ {res_folder}: {size}x{size}px")
        else:
            print(f"  ❌ Erro em {res_folder}: {result.stderr}")

print("\n✅ Ícones gerados com sucesso!")
