import { cx } from '../lib/cx'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

/** 화면 공통 부품. 색은 index.css 의 디자인 토큰만 쓴다 */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white active:bg-accent-strong',
  secondary: 'bg-accent-soft text-accent active:brightness-95',
  ghost: 'bg-sunken text-ink active:brightness-95',
  danger: 'bg-expired-soft text-expired active:brightness-95',
}

export function Button({
  variant = 'primary',
  size = 'lg',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'md' | 'lg' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-2xl font-bold transition disabled:opacity-40',
        size === 'lg' ? 'h-[3.25rem] px-5 text-[15px]' : 'h-11 px-4 text-sm',
        BUTTON_VARIANT[variant],
        className,
      )}
    />
  )
}

/** 선택 칩. tone="suggest" 는 자동완성처럼 '눌러서 채우기' 용 */
export function Chip({
  active = false,
  tone = 'default',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: 'default' | 'suggest' }) {
  return (
    <button
      {...props}
      className={cx(
        'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm whitespace-nowrap transition',
        tone === 'suggest'
          ? 'border-transparent bg-accent-soft font-semibold text-accent'
          : active
            ? 'border-ink bg-ink font-semibold text-white'
            : 'border-line bg-surface text-ink active:bg-sunken',
        className,
      )}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex shrink-0 rounded-xl bg-sunken p-[3px] text-sm', className)} role="tablist">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cx(
            'rounded-[9px] px-3 py-1.5 transition',
            value === v ? 'bg-surface font-bold text-ink shadow-card' : 'text-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-card bg-surface shadow-card', className)}>{children}</div>
}

export function Field({ label, aside, children }: { label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-bold text-muted">{label}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** 16px 이상이라 iOS 에서 확대되지 않는다 */
export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base outline-none transition placeholder:text-faint',
        'focus:border-accent focus:ring-4 focus:ring-accent-soft',
        className,
      )}
    />
  )
}

export function IconButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted transition active:bg-sunken',
        className,
      )}
    />
  )
}

/** 켜고 끄는 스위치. 트랙 44×26, 켜짐은 accent */
export function Switch({
  checked,
  onChange,
  disabled,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-[26px] w-11 shrink-0 rounded-full transition disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-sunken',
      )}
    >
      <span
        className={cx(
          'absolute top-[3px] left-[3px] h-5 w-5 rounded-full bg-white shadow-card transition-transform motion-reduce:transition-none',
          checked && 'translate-x-[18px]',
        )}
      />
    </button>
  )
}

/** 써니사이드업 팀 이스터에그: 로고를 연달아 누르면 잠깐 나오는 반숙 달걀 */
export function SunnyEgg({ size = 36 }: { size?: number }) {
  return (
    <span className="grid shrink-0 animate-[egg-pop_400ms_cubic-bezier(.3,1.6,.5,1)] place-items-center" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 48 48">
        <path
          d="M24 4c7 0 9 6 14 8s7 8 5 14-2 12-9 15-12 2-17 0S5 35 4 28s3-11 6-15 7-9 14-9Z"
          fill="#fff"
          stroke="var(--color-line)"
          strokeWidth="1.5"
        />
        <circle cx="23" cy="24" r="9" fill="#f6c343" />
        <circle cx="20" cy="21" r="2.5" fill="#fff" opacity=".7" />
      </svg>
    </span>
  )
}

/** 앱 로고: 초록 바탕의 냉장고, 문에 반숙 달걀 자석. public/favicon.svg 와 같은 그림 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-accent"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 1024 1024">
        <rect x="322" y="200" width="380" height="624" rx="82" fill="#fff" />
        <rect x="322" y="452" width="380" height="22" fill="var(--color-accent)" />
        <rect x="390" y="290" width="28" height="100" rx="14" fill="var(--color-accent)" />
        <rect x="390" y="540" width="28" height="150" rx="14" fill="var(--color-accent)" />
        <path
          transform="translate(570 640) scale(5.4) translate(-24 -24) rotate(-12 24 24)"
          d="M24 4c7 0 9 6 14 8s7 8 5 14-2 12-9 15-12 2-17 0S5 35 4 28s3-11 6-15 7-9 14-9Z"
          fill="#fdf6e3"
          stroke="var(--color-line)"
          strokeWidth="1.5"
        />
        <circle cx="564" cy="642" r="50" fill="#f6c343" />
      </svg>
    </span>
  )
}
