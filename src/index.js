import Phaser from 'phaser';
import Alpine from 'alpinejs';
import './styles.css';
import demoData from './demo-data.json';

// ユーティリティ関数
function getSuitSymbol(suit) {
    const symbols = {
        'H': '♥',
        'D': '♦', 
        'C': '♣',
        'S': '♠',
        // 後方互換性のため従来の形式もサポート
        'hearts': '♥',
        'diamonds': '♦', 
        'clubs': '♣',
        'spades': '♠'
    };
    return symbols[suit] || suit;
}

// カード文字列をオブジェクトに変換する関数
function parseCardString(cardStr) {
    if (!cardStr || typeof cardStr !== 'string') {
        return { suit: '', value: '' };
    }
    
    // "C_2" -> {suit: "C", value: "2"}
    if (cardStr.includes('_')) {
        const [suit, value] = cardStr.split('_');
        return { suit, value };
    }
    
    // 従来の形式もサポート（後方互換性）
    if (typeof cardStr === 'object' && cardStr.suit && cardStr.value) {
        return cardStr;
    }
    
    return { suit: '', value: '' };
}

// グローバルに公開
window.getSuitSymbol = getSuitSymbol;
window.parseCardString = parseCardString;

// カードをソートする関数
function sortCards(cards) {
    // スートの優先度: スペード > ハート > ダイヤ > クラブ
    const suitOrder = { 
        'S': 0, 'H': 1, 'D': 2, 'C': 3,
        // 後方互換性
        'spades': 0, 'hearts': 1, 'diamonds': 2, 'clubs': 3 
    };
    
    // 数値の優先度: 2 < 3 < 4 < ... < 10 < J < Q < K < A (ハーツゲームの強さ順)
    const valueOrder = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    
    return [...cards].sort((a, b) => {
        // カード文字列を解析
        const cardA = parseCardString(a);
        const cardB = parseCardString(b);
        
        // まずスートでソート
        const suitDiff = suitOrder[cardA.suit] - suitOrder[cardB.suit];
        if (suitDiff !== 0) {
            return suitDiff;
        }
        
        // 同じスートの場合は数値でソート（弱い順：2から始まってAまで）
        return valueOrder[cardA.value] - valueOrder[cardB.value];
    });
}

// Phaser関数は実際の実装箇所で直接定義

// ゲームの設定
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2c5234',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

// Alpine.jsのコントローラー関数
function gameController() {
    const controller = {
        // データ状態
        gameData: null,
        currentTurnIndex: 0,
        currentPlayer: -1,
        playbackSpeed: 1,
        loading: true, // 初期状態はローディング中
        jumpToStep: '',
        jumpToRound: '',
        keyboardListener: null, // キーボードイベントリスナーの参照を保持
        lastKeyTime: 0, // デバウンス用のタイムスタンプ
        jumpToStep: '',
        jumpToRound: '',
        
        // 計算プロパティ
        get hasData() {
            return this.gameData && this.gameData.turns && this.gameData.turns.length > 0;
        },
        
        get currentTurn() {
            if (!this.hasData || this.currentTurnIndex >= this.gameData.turns.length) {
                return null;
            }
            return this.gameData.turns[this.currentTurnIndex];
        },
        
        get timelineProgress() {
            if (!this.hasData) return 0;
            const maxIndex = Math.max(1, this.gameData.turns.length - 1);
            return (this.currentTurnIndex / maxIndex) * 100;
        },
        
        get maxRounds() {
            if (!this.hasData) return 0;
            const rounds = new Set();
            this.gameData.turns.forEach(turn => {
                if (turn.roundNumber) {
                    rounds.add(turn.roundNumber);
                }
            });
            return Math.max(1, rounds.size);
        },
        
        get currentRound() {
            if (!this.currentTurn) return 1;
            return this.currentTurn.roundNumber || 1;
        },
        
        // 初期化
        init() {
            console.log('Alpine.js GameController initialized');
            // ファイル入力の設定
            const fileInput = document.getElementById('replayFile');
            if (fileInput) {
                fileInput.addEventListener('change', (e) => this.handleFileLoad(e));
            }
            
            // Phaserの準備完了イベントを待機
            window.addEventListener('phaserReady', () => {
                console.log('Received phaserReady event, loading demo data...');
                this.loadDemoData();
            });
            
            // キーボードショートカットの設定
            this.setupKeyboardShortcuts();
        },
        
        // キーボードショートカットの設定
        setupKeyboardShortcuts() {
            // 既存のリスナーがあれば削除
            if (this.keyboardListener) {
                document.removeEventListener('keydown', this.keyboardListener);
            }
            
            // 新しいリスナーを作成
            this.keyboardListener = (e) => {
                // フォーカスがinput要素にある場合は無視
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                // 既にイベントがキャンセルされている場合は処理しない
                if (e.defaultPrevented) return;
                
                // デバウンス処理（50ms間隔でキーが押された場合は無視）
                const now = Date.now();
                if (now - this.lastKeyTime < 50) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                this.lastKeyTime = now;
                
                switch(e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.shiftKey) {
                            this.previousTurn(); // Shift + 左矢印: 前のターン
                        } else {
                            this.previousStep(); // 左矢印: 1手戻す
                        }
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.shiftKey) {
                            this.nextTurn(); // Shift + 右矢印: 次のターン
                        } else {
                            this.nextStep(); // 右矢印: 1手進む
                        }
                        break;
                    case 'g':
                    case 'G':
                        e.preventDefault();
                        e.stopPropagation();
                        // 手数入力フィールドにフォーカス
                        const stepInput = document.querySelector('input[x-model="jumpToStep"]');
                        if (stepInput) {
                            stepInput.focus();
                            stepInput.select();
                        }
                        break;
                    case 'r':
                    case 'R':
                        if (e.ctrlKey || e.metaKey) return; // Ctrl+R（リロード）は無視
                        e.preventDefault();
                        e.stopPropagation();
                        this.resetReplay(); // R: リセット
                        break;
                }
            };
            
            // 新しいリスナーを登録（captureフェーズで）
            document.addEventListener('keydown', this.keyboardListener, { capture: true });
        },
        
        // API読み込み
        async loadFromAPI() {
            this.loading = true;
            try {
                const response = await fetch('https://example.com/data');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                this.loadReplayData(data);
                console.log('API data loaded successfully');
            } catch (error) {
                console.error('API loading failed:', error);
                alert(`APIからの読み込みに失敗しました: ${error.message}`);
            } finally {
                this.loading = false;
            }
        },
        
        // デモデータ読み込み
        loadDemoData() {
            console.log('Loading demo data...');
            this.loading = true;
            this.loadReplayData(demoData);
        },
        
        // リプレイデータの設定
        loadReplayData(data) {
            this.loading = true;
            this.gameData = data;
            this.currentTurnIndex = 0;
            this.jumpToStep = '';
            this.jumpToRound = '';
            this.updateCurrentPlayer();
            console.log('Replay data loaded:', data);
            
            // Phaserシーンに手札データを送信
            this.updateGameDisplay();
            
            // データ読み込み完了はupdateGameDisplayで行う
            console.log('Waiting for game display update to complete...');
            
            // Phaserのグローバル変数も更新
            if (window.replayData !== undefined) {
                window.replayData = data;
            }
        },

        // 現在のターンに基づいた手札を計算
        getCurrentHands() {
            if (!this.hasData) return [];
            
            // 現在のターンのplayerHandsを使用（新しいデータ構造）
            const currentTurn = this.currentTurn;
            if (currentTurn && currentTurn.playerHands) {
                // 新しいデータ構造: 各ターンにplayerHandsが含まれている
                const currentHands = this.gameData.players.map((player, index) => {
                    return {
                        ...player,
                        hand: [...(currentTurn.playerHands[index] || [])]
                    };
                });
                console.log('Current hands from playerHands for turn', this.currentTurnIndex + 1, ':', currentHands);
                return currentHands;
            }
            
            // フォールバック: 古いデータ構造の場合、従来の方法で計算
            const currentHands = this.gameData.players.map(player => {
                return {
                    ...player,
                    hand: [...player.hand] // 初期手札をコピー
                };
            });
            
            // 現在のターンまでにプレイされたカードを除去（現在のターンのplay_cardも含む）
            for (let turnIndex = 0; turnIndex <= this.currentTurnIndex; turnIndex++) {
                const turn = this.gameData.turns[turnIndex];
                if (turn && turn.action === 'play_card' && turn.card && turn.currentPlayer !== undefined) {
                    const playerIndex = turn.currentPlayer;
                    const playedCard = parseCardString(turn.card);
                    
                    // プレイヤーの手札からこのカードを除去
                    const hand = currentHands[playerIndex].hand;
                    const cardIndex = hand.findIndex(cardStr => {
                        const card = parseCardString(cardStr);
                        return card.suit === playedCard.suit && card.value === playedCard.value;
                    });
                    
                    if (cardIndex !== -1) {
                        hand.splice(cardIndex, 1);
                        console.log(`Turn ${turnIndex + 1}: Player ${playerIndex} played ${playedCard.suit} ${playedCard.value}`);
                    }
                }
            }
            
            console.log('Current hands calculated for turn', this.currentTurnIndex + 1, ':', currentHands);
            return currentHands;
        },

        // ゲーム表示を更新
        updateGameDisplay() {
            console.log('updateGameDisplay called');
            console.log('window.phaserScene:', window.phaserScene);
            console.log('this.gameData:', this.gameData);
            
            // Phaserシーンが準備できていない場合は少し待ってから再試行
            if (!window.phaserScene || !window.phaserScene.updatePlayerHands) {
                console.log('Phaser scene not ready, retrying in 100ms...');
                setTimeout(() => this.updateGameDisplay(), 100);
                return;
            }
            
            if (window.phaserScene && window.phaserScene.updatePlayerHands && this.gameData) {
                console.log('Calling phaserScene.updatePlayerHands');
                // 現在のターンに基づいた手札を計算
                const currentHands = this.getCurrentHands();
                // ゲームデータのコピーを作成し、現在の手札で更新
                const gameDataForDisplay = {
                    ...this.gameData,
                    players: currentHands
                };
                window.phaserScene.updatePlayerHands(gameDataForDisplay);
                
                // swap アクションの場合、中央にカード交換情報を表示
                if (this.currentTurn && (this.currentTurn.action === 'swap_choice' || this.currentTurn.action === 'swap_receive')) {
                    if (window.phaserScene.displaySwapInfo) {
                        window.phaserScene.displaySwapInfo(this.currentTurn);
                    }
                } else if (this.currentTurn && this.currentTurn.action === 'show_result') {
                    // ラウンド結果表示
                    if (window.phaserScene.displayRoundResult) {
                        window.phaserScene.displayRoundResult(this.currentTurn);
                    }
                } else {
                    // swap以外のアクションの場合、swap情報をクリア
                    if (window.phaserScene.swapInfoGroup) {
                        window.phaserScene.swapInfoGroup.clear(true, true);
                    }
                    // result情報もクリア
                    if (window.phaserScene.resultInfoGroup) {
                        window.phaserScene.resultInfoGroup.clear(true, true);
                    }
                }
                
                // 表示更新が成功した場合、ローディング状態を解除
                if (this.loading) {
                    this.loading = false;
                    console.log('Game display updated successfully, loading state cleared:', this.loading);
                }
            } else {
                console.warn('Cannot update game display:', {
                    phaserScene: !!window.phaserScene,
                    updatePlayerHands: !!(window.phaserScene && window.phaserScene.updatePlayerHands),
                    gameData: !!this.gameData
                });
            }
        },
        
        // ファイル読み込み処理
        handleFileLoad(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            this.loading = true;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.loadReplayData(data);
                } catch (error) {
                    console.error('File loading failed:', error);
                    alert('無効なリプレイファイルです。JSONフォーマットを確認してください。');
                } finally {
                    this.loading = false;
                }
            };
            reader.readAsText(file);
        },
        
        // リセット機能
        resetReplay() {
            this.currentTurnIndex = 0;
            this.jumpToStep = '';
            this.jumpToRound = '';
            this.updateCurrentPlayer();
            console.log('Replay reset');
        },
        
        // 速度切り替え
        toggleSpeed() {
            const speeds = [0.5, 1, 1.5, 2, 3];
            const currentIndex = speeds.indexOf(this.playbackSpeed);
            const nextIndex = (currentIndex + 1) % speeds.length;
            this.playbackSpeed = speeds[nextIndex];
        },
        
        // ターン移動
        previousTurn() {
            if (this.currentTurnIndex > 0) {
                this.currentTurnIndex--;
                this.updateCurrentPlayer();
            }
        },
        
        nextTurn() {
            if (this.hasData && this.currentTurnIndex < this.gameData.turns.length - 1) {
                this.currentTurnIndex++;
                this.updateCurrentPlayer();
            }
        },
        
        // 1手移動（より細かい制御）
        previousStep() {
            console.log('previousStep called, current index:', this.currentTurnIndex);
            if (this.currentTurnIndex > 0) {
                this.currentTurnIndex--;
                this.updateCurrentPlayer();
                this.updateGameDisplay();
                console.log(`1手戻す: ターン ${this.currentTurnIndex + 1}`);
            } else {
                console.log('Cannot go back further - at first turn');
            }
        },
        
        nextStep() {
            console.log('nextStep called, current index:', this.currentTurnIndex, 'max:', this.gameData?.turns?.length - 1);
            if (this.hasData && this.currentTurnIndex < this.gameData.turns.length - 1) {
                this.currentTurnIndex++;
                this.updateCurrentPlayer();
                this.updateGameDisplay();
                console.log(`1手進む: ターン ${this.currentTurnIndex + 1}`);
            } else {
                console.log('Cannot go forward further - at last turn or no data');
            }
        },
        
        // 手数でジャンプ
        jumpToStepNumber() {
            if (!this.hasData) return;
            
            const stepNum = parseInt(this.jumpToStep);
            if (isNaN(stepNum) || stepNum < 1) {
                alert('有効な手数を入力してください（1以上）');
                return;
            }
            
            const targetIndex = stepNum - 1; // 0ベースのインデックスに変換
            if (targetIndex >= this.gameData.turns.length) {
                alert(`手数は1～${this.gameData.turns.length}の範囲で入力してください`);
                return;
            }
            
            this.currentTurnIndex = targetIndex;
            this.updateCurrentPlayer();
            this.updateGameDisplay();
            console.log(`手数 ${stepNum} にジャンプしました`);
        },
        
        // ラウンドでジャンプ
        jumpToRoundNumber() {
            if (!this.hasData) return;
            
            const roundNum = parseInt(this.jumpToRound);
            if (isNaN(roundNum) || roundNum < 1) {
                alert('有効なラウンド番号を入力してください（1以上）');
                return;
            }
            
            if (roundNum > this.maxRounds) {
                alert(`ラウンド番号は1～${this.maxRounds}の範囲で入力してください`);
                return;
            }
            
            // 指定されたラウンドの最初のターンを検索
            const targetTurnIndex = this.gameData.turns.findIndex(turn => 
                turn.roundNumber === roundNum
            );
            
            if (targetTurnIndex === -1) {
                alert(`ラウンド ${roundNum} が見つかりませんでした`);
                return;
            }
            
            this.currentTurnIndex = targetTurnIndex;
            this.updateCurrentPlayer();
            this.updateGameDisplay();
            console.log(`ラウンド ${roundNum} にジャンプしました`);
        },
        
        // タイムライン操作
        seekTimeline(event) {
            if (!this.hasData) return;
            
            const rect = event.currentTarget.getBoundingClientRect();
            const clickX = event.clientX - rect.left;
            const percentage = clickX / rect.width;
            
            this.currentTurnIndex = Math.floor(percentage * this.gameData.turns.length);
            this.currentTurnIndex = Math.max(0, Math.min(this.currentTurnIndex, this.gameData.turns.length - 1));
            this.updateCurrentPlayer();
            this.updateGameDisplay();
        },
        
        // 現在のプレイヤーを更新
        updateCurrentPlayer() {
            if (this.currentTurn) {
                this.currentPlayer = this.currentTurn.currentPlayer;
            } else {
                this.currentPlayer = -1;
            }
        },
        
        // 時間フォーマット
        formatTime(turnIndex) {
            const minutes = Math.floor(turnIndex / 10);
            const seconds = (turnIndex % 10) * 6;
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },
        
        // クリーンアップ処理
        destroy() {
            if (this.keyboardListener) {
                document.removeEventListener('keydown', this.keyboardListener, { capture: true });
                this.keyboardListener = null;
            }
        }
    };
    
    // グローバルアクセス用に参照を保存
    window.gameController = controller;
    return controller;
}

// Alpine.jsをグローバルに登録
window.Alpine = Alpine;
window.gameController = gameController;

// Alpine.jsのデータコンポーネントを登録
Alpine.data('gameController', gameController);

//グローバル変数
let gameScene;

// preload関数の実装  
function preload() {
    console.log('=== Phaser preload started ===');
    // カードの裏面テキスチャを作成
    this.add.graphics()
        .fillStyle(0x1a5490)
        .fillRoundedRect(0, 0, 80, 112, 8)
        .lineStyle(2, 0x0f3660)
        .strokeRoundedRect(0, 0, 80, 112, 8)
        .generateTexture('card-back', 80, 112);
    
    // カードの表面テキスチャを作成
    this.add.graphics()
        .fillStyle(0xffffff)
        .fillRoundedRect(0, 0, 80, 112, 8)
        .lineStyle(2, 0x333333)
        .strokeRoundedRect(0, 0, 80, 112, 8)
        .generateTexture('card-front', 80, 112);
        
    // テーブルのテキスチャ
    this.add.graphics()
        .fillStyle(0x2c5234)
        .fillRoundedRect(0, 0, 700, 500, 20)
        .lineStyle(3, 0x1a3020)
        .strokeRoundedRect(0, 0, 700, 500, 20)
        .generateTexture('table', 700, 500);
        
    // スーツの色分け用テキスチャ
    this.add.graphics()
        .fillStyle(0xff0000) // ハート・ダイヤ用
        .fillRoundedRect(0, 0, 80, 112, 8)
        .lineStyle(2, 0xcc0000)
        .strokeRoundedRect(0, 0, 80, 112, 8)
        .generateTexture('card-red', 80, 112);
        
    this.add.graphics()
        .fillStyle(0x000000) // スペード・クラブ用
        .fillRoundedRect(0, 0, 80, 112, 8)
        .lineStyle(2, 0x333333)
        .strokeRoundedRect(0, 0, 80, 112, 8)
        .generateTexture('card-black', 80, 112);
    
    console.log('=== Phaser preload completed ===');
}

// create関数の実装  
function create() {
    console.log('=== Phaser create scene started ===');
    gameScene = this;
    gameScene = this;
    
    // テーブルを描画
    this.add.image(400, 300, 'table');
    
    // プレイヤーエリアの設定（4人プレイヤー用）
    // 東西南北の配置を明確にする
    this.playerPositions = [
        { x: 400, y: 510, name: 'Alice (南)', rotation: 0 }, // Player 0: Alice（南）- 10px下に移動
        { x: 110, y: 300, name: 'Bob (西)', rotation: Math.PI/2 }, // Player 1: Bob（西）- 10px左に移動
        { x: 400, y: 90, name: 'Charlie (北)', rotation: Math.PI }, // Player 2: Charlie（北）- 10px上に移動
        { x: 690, y: 300, name: 'Dave (東)', rotation: -Math.PI/2 }  // Player 3: Dave（東）- 10px右に移動
    ];
    
    console.log('Player positions configured:', this.playerPositions);
    
    // プレイヤー名を表示
    this.playerNames = [];
    this.playerPositions.forEach((pos, index) => {
        let nameX, nameY, rotation;
        
        // 各プレイヤーの手札の直後にプレイヤー名を配置
        switch(index) {
            case 0: // Alice（南）
                nameX = pos.x - 180; // 手札の左端に合わせる
                nameY = pos.y + 30; // 手札の直後（下側）
                rotation = 0;
                break;
            case 1: // Bob（西）
                nameX = pos.x - 30; // 手札の直後（左側）
                nameY = pos.y - 180; // 手札の上端に合わせる
                rotation = Math.PI / 2; // 90度回転（縦書き風）
                break;
            case 2: // Charlie（北）
                nameX = pos.x + 100; // 手札の右端に合わせる
                nameY = pos.y - 30; // 手札の直後（上側）
                rotation = Math.PI; // 180度回転
                break;
            case 3: // Dave（東）
                nameX = pos.x + 30; // 手札の直後（右側）
                nameY = pos.y + 100; // 手札の下端に合わせる
                rotation = -Math.PI / 2; // -90度回転（縦書き風）
                break;
        }
        
        const nameText = this.add.text(nameX, nameY, pos.name, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold'
        }).setOrigin(index === 0 ? 0 : index === 1 ? 0 : index === 2 ? 1 : 1, 0.5).setRotation(rotation);
        
        this.playerNames.push(nameText);
    });
    
    // カードスプライトのグループを作成
    this.cardGroups = [];
    for (let i = 0; i < 4; i++) {
        this.cardGroups[i] = this.add.group();
    }
    console.log('Card groups created:', this.cardGroups.length);
    
    // 中央のプレイエリア（プレイされたカード表示用）
    this.playedCardsGroup = this.add.group();
    
    // 中央エリアの背景円を追加
    const centerCircle = this.add.graphics()
        .fillStyle(0x1a3020, 0.3)
        .fillCircle(400, 300, 150)
        .lineStyle(2, 0xffffff, 0.5)
        .strokeCircle(400, 300, 150);
    
    // プレイカードの配置位置（中央からのオフセット）
    // プレイヤーインデックスと手札位置を正確に対応させる
    this.playCardPositions = [
        { x: 400, y: 380, playerIndex: 0 }, // Player 0 (Alice, 南) → 中央南
        { x: 280, y: 300, playerIndex: 1 }, // Player 1 (Bob, 西) → 中央西  
        { x: 400, y: 220, playerIndex: 2 }, // Player 2 (Charlie, 北) → 中央北
        { x: 520, y: 300, playerIndex: 3 }  // Player 3 (Dave, 東) → 中央東
    ];
    
    // グローバルアクセス用
    window.phaserScene = this;
    console.log('window.phaserScene set:', window.phaserScene);
    
    // シーンの参照を保持
    const scene = this;
    
    // カード更新関数をPhaserシーンに追加
    this.updatePlayerHands = function(gameData) {
        console.log('=== updatePlayerHands START ===');
        console.log('updatePlayerHands called with data:', gameData);
        
        if (!gameData || !gameData.players) {
            console.warn('No game data or players found');
            return;
        }
        
        // 既存のカードをクリア
        scene.cardGroups.forEach((group, index) => {
            console.log(`Clearing hand group ${index}, children count:`, group.children.size);
            group.clear(true, true);
        });
        
        // 既存のプレイカードをクリア
        scene.playedCardsGroup.clear(true, true);
        
        // 現在のターン情報を取得（Alpine.jsから）
        const currentTurnIndex = window.gameController ? window.gameController.currentTurnIndex : 0;
        console.log('Current turn index:', currentTurnIndex);
        
        // 手札を描画
        console.log('Drawing hands for', gameData.players.length, 'players');
        gameData.players.forEach((player, playerIndex) => {
            console.log(`=== PLAYER ${playerIndex} START ===`);
            
            if (!player.hand || !Array.isArray(player.hand)) {
                console.warn(`Player ${playerIndex} has no valid hand:`, player);
                return;
            }
            
            console.log(`Drawing ${player.hand.length} cards for player ${playerIndex}`);
            const position = scene.playerPositions[playerIndex];
            const cardGroup = scene.cardGroups[playerIndex];
            
            // 手札をソート
            const sortedHand = sortCards(player.hand);
            console.log(`Sorted hand for player ${playerIndex}:`, sortedHand);
            
            // 手札全体のコンテナグループを作成
            const handContainer = scene.add.container(position.x, position.y);
            
            // プレイヤーごとの回転角度を設定
            let handRotation = 0;
            
            if (playerIndex === 0) {
                // 南側プレイヤー：回転なし
                handRotation = 0;
            } else if (playerIndex === 1) {
                // 西側プレイヤー：90度回転
                handRotation = Math.PI / 2;
            } else if (playerIndex === 2) {
                // 北側プレイヤー：180度回転
                handRotation = Math.PI;
            } else if (playerIndex === 3) {
                // 東側プレイヤー：270度回転
                handRotation = Math.PI * 3 / 2;
            }
            
            sortedHand.forEach((cardStr, cardIndex) => {
                // カード文字列を解析
                const card = parseCardString(cardStr);
                
                // 全てのプレイヤーで基本的に横配置（回転は後でコンテナ全体に適用）
                const cardSpacing = 25;
                const totalWidth = (sortedHand.length - 1) * cardSpacing;
                const startX = -totalWidth / 2; // コンテナの原点を基準とした相対位置
                const cardX = startX + (cardIndex * cardSpacing);
                const cardY = -30; // コンテナの原点を基準とした相対位置
                
                try {
                    // カード全体のコンテナグループを作成
                    const cardContainer = scene.add.container(cardX, cardY);
                    
                    // カードスプライト（コンテナの原点0,0を基準）
                    const cardSprite = scene.add.image(0, 0, 'card-front');
                    cardSprite.setScale(0.8);
                    
                    const suitSymbol = getSuitSymbol(card.suit);
                    const textColor = (card.suit === 'H' || card.suit === 'D' || card.suit === 'hearts' || card.suit === 'diamonds') ? '#ff0000' : '#000000';
                    
                    // 左上のスートラベル（コンテナの原点0,0を基準）
                    const suitLabel = scene.add.text(-30, -44, suitSymbol, {
                        fontSize: '18px',
                        fill: textColor,
                        fontFamily: 'Arial',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        padding: { x: 2, y: 1 },
                        align: 'center'
                    }).setOrigin(0);
                    
                    // 左上の値ラベル（コンテナの原点0,0を基準）
                    const valueLabel = scene.add.text(-30, -28, card.value, {
                        fontSize: '13px',
                        fill: textColor,
                        fontFamily: 'Arial',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        padding: { x: 2, y: 1 },
                        align: 'center'
                    }).setOrigin(0);
                    
                    // カード中央のテキスト（コンテナの原点0,0を基準）
                    const cardValue = `${getSuitSymbol(card.suit)}${card.value}`;
                    const centerText = scene.add.text(0, 0, cardValue, {
                        fontSize: '18px',
                        fill: textColor,
                        fontFamily: 'Arial',
                        fontWeight: 'bold'
                    }).setOrigin(0.5);
                    
                    // コンテナに全要素を追加
                    cardContainer.add([cardSprite, suitLabel, valueLabel, centerText]);
                    
                    // 手札コンテナに追加
                    handContainer.add(cardContainer);
                    
                } catch (error) {
                    console.error(`Error creating card ${cardIndex} for player ${playerIndex}:`, error);
                }
            });
            
            // 手札全体を回転
            handContainer.setRotation(handRotation);
            
            // カードグループに手札コンテナを追加
            cardGroup.add(handContainer);
            
            console.log(`=== PLAYER ${playerIndex} END ===`);
        });
        
        // プレイされたカードを中央に表示
        scene.displayPlayedCards(gameData, currentTurnIndex);
        
        console.log('=== updatePlayerHands END ===');
    };
    
    // プレイされたカードを中央に表示する関数
    this.displayPlayedCards = function(gameData, currentTurnIndex) {
        console.log('=== displayPlayedCards START ===');
        console.log('Current turn index:', currentTurnIndex);
        
        if (!gameData.turns || currentTurnIndex < 0) {
            return;
        }
        
        // 現在のターンをチェック
        const currentTurn = gameData.turns[currentTurnIndex];
        
        // trick_start状態またはカードがプレイされていない場合は早期リターン
        if (!currentTurn || currentTurn.action === 'trick_start' || currentTurnIndex === 0) {
            return;
        }
        
        // 現在のトリック（プレイされたカード）を収集
        const currentRound = currentTurnIndex < gameData.turns.length ? 
                            gameData.turns[currentTurnIndex].roundNumber : 1;
        
        // 現在のトリック内でプレイされたカードを取得
        const currentTrickCards = [];
        
        // trick_wonターンの場合、直前の完成したトリックを表示
        if (currentTurn.action === 'trick_won') {
            // trick_wonの直前まで遡って、最新の完成したトリックを取得
            for (let i = currentTurnIndex - 1; i >= 0; i--) {
                const turn = gameData.turns[i];
                
                if (!turn) continue;
                
                // trick_startまたは前のtrick_wonが見つかったら停止
                if (turn.action === 'trick_start' || turn.action === 'trick_won') {
                    break;
                }
                
                // play_cardアクションのみを収集
                if (turn.action === 'play_card') {
                    currentTrickCards.unshift({
                        player: turn.currentPlayer,
                        card: turn.card,
                        turnIndex: i
                    });
                    
                    // 4枚集まったらトリック完成
                    if (currentTrickCards.length >= 4) {
                        break;
                    }
                }
            }
        } else {
            // 通常のターンの場合、現在位置から逆方向に検索
            for (let i = currentTurnIndex; i >= 0; i--) {
                const turn = gameData.turns[i];
                
                if (!turn) continue;
                
                // trick_startが見つかったら、そこでトリックの開始点なので停止
                if (turn.action === 'trick_start') {
                    break;
                }
                
                // trick_wonが見つかったら、前のトリックの終了点なので停止
                if (turn.action === 'trick_won') {
                    break;
                }
                
                // play_cardアクションのみを収集
                if (turn.action === 'play_card') {
                    currentTrickCards.unshift({
                        player: turn.currentPlayer,
                        card: turn.card,
                        turnIndex: i
                    });
                    
                    // 4枚集まったらトリック完成
                    if (currentTrickCards.length >= 4) {
                        break;
                    }
                }
            }
        }
        
        console.log('Current trick cards:', currentTrickCards);
        
        // trick_wonアクションの場合、勝利カードを特定
        let winningPlayer = null;
        if (currentTurn && currentTurn.action === 'trick_won' && currentTurn.winningPlayer !== undefined) {
            winningPlayer = currentTurn.winningPlayer;
            console.log(`Winning player: ${winningPlayer}`);
        }
        
        // プレイされたカードを中央に配置
        currentTrickCards.forEach((cardData, index) => {
            // プレイヤーインデックスに対応する位置を取得
            const position = scene.playCardPositions.find(pos => pos.playerIndex === cardData.player);
            
            if (!position) {
                console.error(`Position not found for player ${cardData.player}`);
                return;
            }
            
            console.log(`Placing card for player ${cardData.player} at position:`, position);
            
            try {
                // プレイカード全体のコンテナグループを作成
                const playedCardContainer = scene.add.container(position.x, position.y);
                
                // プレイヤーごとの回転角度を設定（手札と同じ）
                let cardRotation = 0;
                if (cardData.player === 0) {
                    // 南側プレイヤー：回転なし
                    cardRotation = 0;
                } else if (cardData.player === 1) {
                    // 西側プレイヤー：90度回転
                    cardRotation = Math.PI / 2;
                } else if (cardData.player === 2) {
                    // 北側プレイヤー：180度回転
                    cardRotation = Math.PI;
                } else if (cardData.player === 3) {
                    // 東側プレイヤー：270度回転
                    cardRotation = Math.PI * 3 / 2;
                }
                
                // カードスプライト（コンテナの原点0,0を基準）
                const playedCardSprite = scene.add.image(0, 0, 'card-front');
                playedCardSprite.setScale(0.9);
                
                // カード文字列を解析
                const parsedCard = parseCardString(cardData.card);
                const suitSymbol = getSuitSymbol(parsedCard.suit);
                const textColor = (parsedCard.suit === 'H' || parsedCard.suit === 'D' || parsedCard.suit === 'hearts' || parsedCard.suit === 'diamonds') ? '#ff0000' : '#000000';
                
                // 左上のスートラベル（コンテナの原点0,0を基準）
                const suitLabel = scene.add.text(-30, -44, suitSymbol, {
                    fontSize: '18px',
                    fill: textColor,
                    fontFamily: 'Arial',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    padding: { x: 2, y: 1 },
                    align: 'center'
                }).setOrigin(0);
                
                // 左上の値ラベル（コンテナの原点0,0を基準）
                const valueLabel = scene.add.text(-30, -28, parsedCard.value, {
                    fontSize: '13px',
                    fill: textColor,
                    fontFamily: 'Arial',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    padding: { x: 2, y: 1 },
                    align: 'center'
                }).setOrigin(0);
                
                // カード中央のテキスト（コンテナの原点0,0を基準）
                const cardValue = `${getSuitSymbol(parsedCard.suit)}${parsedCard.value}`;
                const centerText = scene.add.text(0, 0, cardValue, {
                    fontSize: '18px',
                    fill: textColor,
                    fontFamily: 'Arial',
                    fontWeight: 'bold'
                }).setOrigin(0.5);
                
                // コンテナに全要素を追加
                playedCardContainer.add([playedCardSprite, suitLabel, valueLabel, centerText]);
                
                // カード全体を回転
                playedCardContainer.setRotation(cardRotation);
                
                // 勝利プレイヤーのカードの場合、赤い枠を追加
                if (winningPlayer !== null && winningPlayer === cardData.player) {
                    const winningBorder = scene.add.graphics();
                    winningBorder.lineStyle(4, 0xff0000, 1); // 赤色、4pxの線
                    
                    // プレイヤーの位置に基づいて矩形のサイズと位置を調整
                    if (cardData.player === 1 || cardData.player === 3) {
                        // 東西プレイヤー（横向きカード）の場合
                        winningBorder.strokeRect(position.x - 65, position.y - 45, 130, 90);
                    } else {
                        // 南北プレイヤー（縦向きカード）の場合
                        winningBorder.strokeRect(position.x - 45, position.y - 65, 90, 130);
                    }
                    
                    scene.playedCardsGroup.add(winningBorder);
                    console.log(`Added winning border for player ${cardData.player}`);
                }
                
                // プレイヤー表示
                const playerLabel = scene.add.text(position.x, position.y + 60, `P${cardData.player + 1}`, {
                    fontSize: '10px',
                    fill: '#ffffff',
                    fontFamily: 'Arial'
                }).setOrigin(0.5);
                
                // グループに追加
                scene.playedCardsGroup.add(playedCardContainer);
                scene.playedCardsGroup.add(playerLabel);
                
                console.log(`Added played card for player ${cardData.player}:`, cardData.card);
                
            } catch (error) {
                console.error(`Error creating played card for player ${cardData.player}:`, error);
            }
        });
        
        console.log('=== displayPlayedCards END ===');
    };
    
    // カード交換情報を表示する機能を追加
    this.swapInfoGroup = this.add.group();
    this.resultInfoGroup = this.add.group(); // 結果表示用グループを追加
    
    this.displaySwapInfo = function(turnData) {
        console.log('=== displaySwapInfo START ===');
        console.log('Turn data:', turnData);
        
        // 既存のswap情報をクリア
        scene.swapInfoGroup.clear(true, true);
        
        if (!turnData || (!turnData.swapChoices && !turnData.swapReceived)) {
            console.log('No swap data to display');
            return;
        }
        
        const centerX = 400;
        const centerY = 300;
        
        if (turnData.action === 'swap_choice') {
            // 各プレイヤーの選択カードを表示
            const playerPositions = [
                { x: centerX, y: centerY + 70, label: 'Alice' },
                { x: centerX - 160, y: centerY, label: 'Bob' },
                { x: centerX, y: centerY - 70, label: 'Carol' },
                { x: centerX + 160, y: centerY, label: 'Dave' }
            ];
            
            turnData.swapChoices.forEach((choices, playerIndex) => {
                const pos = playerPositions[playerIndex];
                
                // プレイヤー名
                const playerName = scene.add.text(pos.x, pos.y - 30, 
                    `${pos.label} が選択:`, {
                    fontSize: '12px',
                    fill: '#ffffff',
                    fontFamily: 'Arial',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    padding: { x: 5, y: 2 }
                }).setOrigin(0.5);
                scene.swapInfoGroup.add(playerName);
                
                // 選択したカード
                choices.forEach((cardStr, cardIndex) => {
                    const card = parseCardString(cardStr);
                    const cardX = pos.x + (cardIndex - 1) * 25;
                    const cardY = pos.y;
                    
                    const cardText = scene.add.text(cardX, cardY, 
                        `${getSuitSymbol(card.suit)}${card.value}`, {
                        fontSize: '14px',
                        fill: (card.suit === 'H' || card.suit === 'D') ? '#ff0000' : '#000000',
                        fontFamily: 'Arial',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        padding: { x: 3, y: 2 }
                    }).setOrigin(0.5);
                    scene.swapInfoGroup.add(cardText);
                });
            });
            
        } else if (turnData.action === 'swap_receive') {
            // 各プレイヤーの受け取ったカードを表示（選択と同じレイアウト）
            const playerPositions = [
                { x: centerX, y: centerY + 70, label: 'Alice', index: 0 },
                { x: centerX - 160, y: centerY, label: 'Bob', index: 1 },
                { x: centerX, y: centerY - 70, label: 'Carol', index: 2 },
                { x: centerX + 160, y: centerY, label: 'Dave', index: 3 }
            ];
            
            // 誰から誰がカードを受け取ったかを計算
            const senderNames = ['Alice', 'Bob', 'Carol', 'Dave'];
            
            playerPositions.forEach((pos, playerIndex) => {
                // このプレイヤーがカードをもらった相手を特定
                let senderIndex = -1;
                for (let i = 0; i < 4; i++) {
                    if (turnData.swapPattern[i] === playerIndex) {
                        senderIndex = i;
                        break;
                    }
                }
                
                if (senderIndex !== -1) {
                    // プレイヤー名（誰からもらったか）
                    const playerName = scene.add.text(pos.x, pos.y - 30, 
                        `${pos.label} が ${senderNames[senderIndex]} からもらった:`, {
                        fontSize: '12px',
                        fill: '#ffffff',
                        fontFamily: 'Arial',
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        padding: { x: 5, y: 2 }
                    }).setOrigin(0.5);
                    scene.swapInfoGroup.add(playerName);
                    
                    // 受け取ったカード（送り手が選択したカード）
                    const receivedCards = turnData.swapChoices[senderIndex];
                    receivedCards.forEach((cardStr, cardIndex) => {
                        const card = parseCardString(cardStr);
                        const cardX = pos.x + (cardIndex - 1) * 25;
                        const cardY = pos.y;
                        
                        const cardText = scene.add.text(cardX, cardY, 
                            `${getSuitSymbol(card.suit)}${card.value}`, {
                            fontSize: '14px',
                            fill: (card.suit === 'H' || card.suit === 'D') ? '#ff0000' : '#000000',
                            fontFamily: 'Arial',
                            fontWeight: 'bold',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            padding: { x: 3, y: 2 }
                        }).setOrigin(0.5);
                        scene.swapInfoGroup.add(cardText);
                    });
                }
            });
        }
        
        console.log('=== displaySwapInfo END ===');
    };
    
    // ラウンド結果を表示する機能を追加
    this.displayRoundResult = function(turnData) {
        console.log('=== displayRoundResult START ===');
        console.log('Result data:', turnData);
        
        // 既存の結果情報をクリア
        scene.resultInfoGroup.clear(true, true);
        
        if (!turnData || !turnData.roundPoints || !turnData.cumulativeScores) {
            console.log('No result data to display');
            return;
        }
        
        const centerX = 400;
        const centerY = 300;
        
        // タイトル
        const titleText = scene.add.text(centerX, centerY - 120, 
            `ラウンド${turnData.roundNumber} 結果`, {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: { x: 15, y: 8 }
        }).setOrigin(0.5);
        scene.resultInfoGroup.add(titleText);
        
        // プレイヤー名
        const playerNames = ['Alice', 'Bob', 'Carol', 'Dave'];
        
        // ヘッダー
        const headerY = centerY - 70;
        const headerText = scene.add.text(centerX, headerY, 
            'プレイヤー    ラウンド得点    累積得点', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5);
        scene.resultInfoGroup.add(headerText);
        
        // 各プレイヤーの結果
        playerNames.forEach((name, index) => {
            const y = centerY - 30 + (index * 25);
            const roundPoints = turnData.roundPoints[index];
            const cumulativeScore = turnData.cumulativeScores[index];
            
            const playerResult = scene.add.text(centerX, y, 
                `${name.padEnd(12)}${roundPoints.toString().padStart(8)}${cumulativeScore.toString().padStart(12)}`, {
                fontSize: '14px',
                fill: '#ffffff',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                padding: { x: 8, y: 3 }
            }).setOrigin(0.5);
            scene.resultInfoGroup.add(playerResult);
        });
        
        // 最終ラウンドの場合、勝者を表示
        if (turnData.roundNumber === 3) {
            const minScore = Math.min(...turnData.cumulativeScores);
            const winners = [];
            turnData.cumulativeScores.forEach((score, index) => {
                if (score === minScore) {
                    winners.push(playerNames[index]);
                }
            });
            
            const winnerText = winners.length === 1 
                ? `🎉 ${winners[0]} の勝利！ 🎉`
                : `🎉 ${winners.join('、')} の同点勝利！ 🎉`;
                
            const winnerDisplay = scene.add.text(centerX, centerY + 50, 
                winnerText, {
                fontSize: '20px',
                fill: '#FFD700',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                backgroundColor: 'rgba(255, 0, 0, 0.3)',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5);
            scene.resultInfoGroup.add(winnerDisplay);
        }
        
        console.log('=== displayRoundResult END ===');
    };
    
    // 交換先プレイヤー名を取得するヘルパー関数
    function getSwapTarget(playerIndex, swapPattern) {
        const names = ['Alice', 'Bob', 'Carol', 'Dave'];
        return names[swapPattern[playerIndex]];
    }
    
    // シーンの初期化完了を通知
    console.log('Phaser scene initialization completed');
    
    // デモデータを自動ロード（シーン初期化完了後）
    setTimeout(() => {
        console.log('Trying to load demo data from scene...');
        
        // Alpine.jsコンポーネントに直接イベントを送信
        window.dispatchEvent(new CustomEvent('phaserReady', {
            detail: { message: 'Phaser scene is ready' }
        }));
        
        // また、直接的な方法も試行
        const container = document.querySelector('[x-data]');
        if (container && container._x_dataStack && container._x_dataStack[0]) {
            const alpineData = container._x_dataStack[0];
            if (alpineData.loadDemoData) {
                console.log('Loading demo data via Alpine component...');
                alpineData.loadDemoData();
            }
        }
    }, 100);
};

// 勝利カードを判定する関数
function determineWinningCard(trickCards) {
    if (trickCards.length === 0) return null;
    
    // 最初にプレイされたカードのスートがリードスート
    const firstCard = parseCardString(trickCards[0].card);
    const leadSuit = firstCard.suit;
    console.log('Lead suit:', leadSuit);
    
    // リードスートのカードのみを考慮
    const followSuitCards = trickCards.filter(cardData => {
        const parsedCard = parseCardString(cardData.card);
        return parsedCard.suit === leadSuit;
    });
    
    if (followSuitCards.length === 0) return trickCards[0]; // エラー処理
    
    // カードの強さを判定する関数
    function getCardStrength(cardStr) {
        const card = parseCardString(cardStr);
        const valueOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        return valueOrder.indexOf(card.value);
    }
    
    // 最も強いカードを見つける
    let winningCard = followSuitCards[0];
    for (let i = 1; i < followSuitCards.length; i++) {
        if (getCardStrength(followSuitCards[i].card) > getCardStrength(winningCard.card)) {
            winningCard = followSuitCards[i];
        }
    }
    
    console.log('Winning card:', winningCard);
    return winningCard;
}

// update関数の実装
function update() {
    // ゲームループ（リプレイ再生時に使用）
    // Alpine.jsのグローバル状態を参照してアップデートを実行
}

// エクスポート（デバッグ用）
window.GameViewer = {
    gameController,
    demoData
};

// ファイル読み込み処理
function handleFileLoad(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            // JSONファイルとして読み込みを試行
            replayData = JSON.parse(e.target.result);
            loadReplayData(replayData);
        } catch (error) {
            console.error('ファイルの読み込みに失敗しました:', error);
            alert('無効なリプレイファイルです。JSONフォーマットを確認してください。');
        }
    };
    reader.readAsText(file);
}

// リプレイデータの読み込み
function loadReplayData(data) {
    // ゲーム情報を更新
    document.getElementById('gameType').textContent = data.gameType || 'Harts';
    document.getElementById('gameTime').textContent = data.startTime || new Date().toLocaleString();
    document.getElementById('totalTurns').textContent = data.turns ? data.turns.length : 0;
    
    // プレイヤー情報を更新
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    
    if (data.players) {
        data.players.forEach((player, index) => {
            const playerItem = document.createElement('li');
            playerItem.className = 'player-item';
            playerItem.innerHTML = `
                <span class="player-name">${player.name || `Player ${index + 1}`}</span>
                <span class="player-score">${player.score || 0}</span>
            `;
            playerList.appendChild(playerItem);
        });
    }
    
    // コントロールを有効化
    enableControls(true);
    
    console.log('リプレイデータを読み込みました:', data);
}

// コントロールの有効/無効切り替え
function enableControls(enable) {
    const controls = ['playBtn', 'pauseBtn', 'stopBtn', 'resetBtn', 'prevTurnBtn', 'nextTurnBtn'];
    controls.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.disabled = !enable;
        }
    });
}

// 再生コントロール関数
function playReplay() {
    if (!replayData) return;
    isPlaying = true;
    console.log('リプレイを再生開始');
}

function pauseReplay() {
    isPlaying = false;
    console.log('リプレイを一時停止');
}

function stopReplay() {
    isPlaying = false;
    currentTurnIndex = 0;
    updateUI();
    console.log('リプレイを停止');
}

function resetReplay() {
    isPlaying = false;
    currentTurnIndex = 0;
    updateUI();
    console.log('リプレイをリセット');
}

function toggleSpeed() {
    const speeds = [0.5, 1, 1.5, 2, 3];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    playbackSpeed = speeds[nextIndex];
    
    const speedBtn = document.getElementById('speedBtn');
    speedBtn.textContent = `速度: ${playbackSpeed}x`;
}

function previousTurn() {
    if (currentTurnIndex > 0) {
        currentTurnIndex--;
        updateUI();
    }
}

function nextTurn() {
    if (replayData && currentTurnIndex < replayData.turns.length - 1) {
        currentTurnIndex++;
        updateUI();
    }
}

function seekTimeline(event) {
    if (!replayData) return;
    
    const timeline = event.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    currentTurnIndex = Math.floor(percentage * replayData.turns.length);
    updateUI();
}

// UI更新
function updateUI() {
    if (!replayData) return;
    
    // 現在のターンを更新
    document.getElementById('currentTurn').textContent = currentTurnIndex + 1;
    
    // タイムライン更新
    const progress = (currentTurnIndex / Math.max(1, replayData.turns.length - 1)) * 100;
    document.getElementById('timelineProgress').style.width = progress + '%';
    
    // 時間表示更新（仮の実装）
    const currentMinutes = Math.floor(currentTurnIndex / 10);
    const currentSeconds = (currentTurnIndex % 10) * 6;
    const totalMinutes = Math.floor(replayData.turns.length / 10);
    const totalSeconds = (replayData.turns.length % 10) * 6;
    
    document.getElementById('currentTime').textContent = 
        `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds.toString().padStart(2, '0')}`;
    document.getElementById('totalTime').textContent = 
        `${totalMinutes.toString().padStart(2, '0')}:${totalSeconds.toString().padStart(2, '0')}`;
}

// グローバル変数の定義
let game;
let replayData = demoData;

// ゲーム初期化
window.addEventListener('load', () => {
    console.log('=== Window load event triggered ===');
    
    // Alpine.jsを開始
    console.log('Starting Alpine.js...');
    Alpine.start();
    console.log('Alpine.js started');
    
    // Phaserゲームを初期化
    console.log('Creating Phaser game with config:', config);
    try {
        game = new Phaser.Game(config);
        console.log('Phaser game created successfully:', game);
        
        // グローバル参照用
        window.phaserGame = game;
        console.log('Phaser game set to window.phaserGame');
    } catch (error) {
        console.error('Failed to create Phaser game:', error);
    }
    
    // グローバル関数は既に定義済み（playReplay, pauseReplay, stopReplay, resetReplay）
    
    // デモデータの自動ロードはPhaserシーンの初期化完了後に実行される
    
    // ページ終了時のクリーンアップ
    window.addEventListener('beforeunload', () => {
        if (window.Alpine && window.Alpine.store && window.Alpine.store('gameController')) {
            window.Alpine.store('gameController').destroy();
        }
    });
});

// エクスポート（デバッグ用）
window.GameViewer = {
    game,
    replayData,
    playReplay,
    pauseReplay,
    stopReplay,
    resetReplay
};
