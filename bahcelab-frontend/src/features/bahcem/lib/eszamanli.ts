/** En çok `n` eşzamanlı çalıştıran basit sınırlayıcı: uzun geçmişli bahçede onlarca ızgara isteği sunucunun oturum havuzunu aynı anda tüketmesin. */
export function eszamanliSinir(n: number): <T>(is: () => Promise<T>) => Promise<T> {
  let calisan = 0
  const kuyruk: (() => void)[] = []
  const sirada = () => {
    while (calisan < n && kuyruk.length) {
      calisan += 1
      kuyruk.shift()!()
    }
  }
  return <T,>(is: () => Promise<T>) =>
    new Promise<T>((coz, red) => {
      kuyruk.push(() => {
        is().then(coz, red).finally(() => {
          calisan -= 1
          sirada()
        })
      })
      sirada()
    })
}
