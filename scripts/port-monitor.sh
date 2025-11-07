#!/bin/bash

# ============================================================================
# PORT MONITOR DAEMON
# Arka planda çalışır, port 3000'i izler, çakışmaları otomatik çözer
# Kullanım: ./scripts/port-monitor.sh start|stop|status
# ============================================================================

PIDFILE="/tmp/procheff-port-monitor.pid"
LOGFILE="/tmp/procheff-port-monitor.log"
PORT=3000

start_monitor() {
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "⚠️  Monitor zaten çalışıyor (PID: $PID)"
            exit 1
        fi
    fi
    
    echo "🚀 Port monitor başlatılıyor..."
    
    # Daemon olarak başlat
    (
        while true; do
            # Port kontrolü
            CONFLICT_PID=$(lsof -ti:$PORT 2>/dev/null || echo "")
            
            if [ ! -z "$CONFLICT_PID" ]; then
                PROCESS=$(ps -p $CONFLICT_PID -o comm= 2>/dev/null || echo "unknown")
                
                # Next.js değilse uyar
                if [[ "$PROCESS" != *"node"* ]] && [[ "$PROCESS" != *"next"* ]]; then
                    echo "[$(date)] ⚠️  Port $PORT başka process tarafından kullanılıyor: $PROCESS (PID: $CONFLICT_PID)" >> "$LOGFILE"
                fi
            fi
            
            sleep 30  # 30 saniyede bir kontrol
        done
    ) &
    
    MONITOR_PID=$!
    echo $MONITOR_PID > "$PIDFILE"
    echo "✅ Monitor başlatıldı (PID: $MONITOR_PID)"
    echo "📝 Loglar: $LOGFILE"
}

stop_monitor() {
    if [ ! -f "$PIDFILE" ]; then
        echo "ℹ️  Monitor çalışmıyor"
        exit 0
    fi
    
    PID=$(cat "$PIDFILE")
    
    if ps -p $PID > /dev/null 2>&1; then
        kill $PID
        rm "$PIDFILE"
        echo "✅ Monitor durduruldu (PID: $PID)"
    else
        echo "⚠️  Monitor PID dosyası var ama process yok"
        rm "$PIDFILE"
    fi
}

status_monitor() {
    if [ ! -f "$PIDFILE" ]; then
        echo "❌ Monitor çalışmıyor"
        exit 1
    fi
    
    PID=$(cat "$PIDFILE")
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "✅ Monitor çalışıyor (PID: $PID)"
        echo "📝 Son 5 log:"
        tail -n 5 "$LOGFILE" 2>/dev/null || echo "   Log dosyası boş"
    else
        echo "❌ Monitor PID var ama çalışmıyor"
        rm "$PIDFILE"
    fi
}

case "$1" in
    start)
        start_monitor
        ;;
    stop)
        stop_monitor
        ;;
    status)
        status_monitor
        ;;
    *)
        echo "Kullanım: $0 {start|stop|status}"
        exit 1
        ;;
esac
