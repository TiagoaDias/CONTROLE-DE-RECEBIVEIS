import React, { useState, useEffect, useRef, useMemo } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  overscan?: number;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Componente de Virtualização de Listas de Altura Fixa/Estimada
 * Renderiza apenas os itens visíveis no viewport do container + overscan,
 * reduzindo o consumo de memória e eliminando travamentos em rolagem mobile.
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  keyExtractor,
  overscan = 5,
  className = '',
  emptyState = null,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight || window.innerHeight);
      } else {
        setContainerHeight(window.innerHeight);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const totalItems = items.length;
  const totalHeight = totalItems * itemHeight;

  const { startIndex, endIndex, offsetY } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(totalItems, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
    const offset = start * itemHeight;

    return { startIndex: start, endIndex: end, offsetY: offset };
  }, [scrollTop, containerHeight, itemHeight, totalItems, overscan]);

  if (totalItems === 0) {
    return <>{emptyState}</>;
  }

  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto relative w-full ${className}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <React.Fragment key={keyExtractor(item, actualIndex)}>
                {renderItem(item, actualIndex)}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook de Virtualização Progressiva / Windowing Fluido para Dispositivos Móveis
 * Ideal para listas de altura dinâmica (ex: cartões de devedores e faturas expansíveis).
 * Mantém no DOM um lote otimizado de itens e expande progressivamente conforme o usuário rola a página,
 * garantindo taxa de quadros a 60fps sem engasgos em telas sensíveis ao toque.
 */
export function useProgressiveVirtualList<T>(
  items: T[],
  batchSize: number = 20
) {
  const [visibleCount, setVisibleCount] = useState<number>(batchSize);
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  // Reseta a contagem quando os itens filtrados ou lista mudam
  useEffect(() => {
    setVisibleCount(batchSize);
  }, [items.length, batchSize]);

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + batchSize, items.length));
        }
      },
      {
        root: null,
        rootMargin: '300px', // Carrega o próximo lote com antecedência de 300px
        threshold: 0.1,
      }
    );

    observer.observe(target);
    return () => {
      observer.unobserve(target);
    };
  }, [items.length, batchSize]);

  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount);
  }, [items, visibleCount]);

  const hasMore = visibleCount < items.length;

  const sentinel = (
    <div
      ref={observerTargetRef}
      className="w-full h-8 flex items-center justify-center my-2 pointer-events-none opacity-60"
    >
      {hasMore && (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>Carregando mais itens da lista... ({visibleCount} de {items.length})</span>
        </div>
      )}
    </div>
  );

  return {
    visibleItems,
    hasMore,
    sentinel,
    visibleCount,
  };
}
