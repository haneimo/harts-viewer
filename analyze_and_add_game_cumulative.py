#!/usr/bin/env python3
"""
デモデータを分析してラウンド別の累積ポイントを確認し、
ゲーム全体の累積ペナルティポイントを正確に計算するスクリプト
"""

import json

def analyze_penalty_points(data):
    """ペナルティポイントの分析"""
    
    # ラウンド別の最終ポイントを記録
    round_finals = {}
    
    print("📊 ペナルティポイント分析:")
    print("=" * 60)
    
    for turn in data.get('turns', []):
        if 'cumulativePenaltyPoints' in turn:
            round_num = turn.get('roundNumber', 1)
            turn_num = turn.get('turnNumber', 0)
            penalties = turn['cumulativePenaltyPoints']
            action = turn.get('action', '')
            
            # ラウンド終了ポイント（trick_wonまたはshow_result）を記録
            if action in ['trick_won', 'show_result']:
                round_finals[round_num] = penalties.copy()
                
            if turn_num <= 10 or action in ['trick_won', 'show_result']:
                print(f"ターン{turn_num:3d} (ラウンド{round_num}) [{action:12}]: {penalties}")
    
    print("\n🎯 ラウンド別最終ポイント:")
    print("=" * 40)
    for round_num in sorted(round_finals.keys()):
        print(f"ラウンド{round_num}終了時: {round_finals[round_num]}")
    
    return round_finals

def add_game_cumulative_penalty_points(data):
    """ゲーム全体の累積ペナルティポイントを追加"""
    
    # まずデータを分析
    round_finals = analyze_penalty_points(data)
    
    # プレイヤー数
    num_players = len(data.get('players', []))
    
    # ゲーム累積ペナルティポイント
    game_cumulative = [0] * num_players
    turns_modified = 0
    
    print("\n🔄 ゲーム累積ペナルティポイントを追加中...")
    print("=" * 50)
    
    for turn in data.get('turns', []):
        if 'cumulativePenaltyPoints' in turn:
            round_num = turn.get('roundNumber', 1)
            current_round_penalties = turn['cumulativePenaltyPoints']
            
            # ラウンドに基づいてゲーム累積を計算
            if round_num == 1:
                # ラウンド1：ラウンド累積 = ゲーム累積
                game_cumulative = current_round_penalties.copy()
            elif round_num == 2:
                # ラウンド2：ラウンド1最終 + ラウンド2累積
                round1_final = round_finals.get(1, [0] * num_players)
                for i in range(num_players):
                    game_cumulative[i] = round1_final[i] + current_round_penalties[i]
            elif round_num == 3:
                # ラウンド3：ラウンド2最終 + ラウンド3累積
                round2_final = round_finals.get(2, [0] * num_players)
                for i in range(num_players):
                    game_cumulative[i] = round2_final[i] + current_round_penalties[i]
            
            # ゲーム累積ペナルティポイントを追加
            turn['cumulativeGamePenaltyPoints'] = game_cumulative.copy()
            turns_modified += 1
    
    print(f"✅ {turns_modified} ターンに cumulativeGamePenaltyPoints を追加しました")
    
    return data

def main():
    input_file = 'src/demo-data.json'
    output_file = 'src/demo-data.json'
    
    try:
        print("📖 デモデータファイルを読み込み中...")
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # ゲーム累積ペナルティポイントを追加
        modified_data = add_game_cumulative_penalty_points(data)
        
        # ファイルに保存
        print(f"\n💾 修正されたデータを保存中: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(modified_data, f, indent=2, ensure_ascii=False)
        
        print("✅ ゲーム累積ペナルティポイントの追加が完了しました！")
        
        # 最終結果を表示
        final_players = modified_data.get('players', [])
        print(f"\n🏆 最終プレイヤースコア:")
        for player in final_players:
            print(f"  {player.get('name', 'Unknown')}: {player.get('score', 0)} pt")
    
    except FileNotFoundError:
        print(f"❌ ファイルが見つかりません: {input_file}")
    except Exception as e:
        print(f"❌ エラー: {e}")

if __name__ == '__main__':
    main()