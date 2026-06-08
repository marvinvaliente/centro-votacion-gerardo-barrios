'use client'

import { useState, useEffect } from 'react'
import { Download, CheckCircle, AlertTriangle, Loader } from 'lucide-react'

const REGISTROS = [{"dui":"02244915-7","frente_id":"1bHjZhseUBBUlmVaSsuSSE6N9qxU1rzXo","reverso_id":"1GB1mPtdn5QwsD9NS5Xkmo4anOxQLcKLr"},{"dui":"05369772-5","frente_id":"1iQ0H96sfOI-4z3B0HDcrq9ziqtaGGGbK","reverso_id":"1PDIUIMl5zptZHA1LRHYqv4sbWhs8HhUR"},{"dui":"04325191-7","frente_id":"1p_gCpWPr_kTWoGH23r2A8kye17mEL05p","reverso_id":"1J-N3Di2lpo0mZFJDylDwibeeeBMdloCN"},{"dui":"05665308-9","frente_id":"1BskRHvn3LHn4J-jpVr-JLmFnB59JMilQ","reverso_id":"1bqIxeB8Mvc7HTE-ZLX0gwglnyctpChAV"},{"dui":"06281832-0","frente_id":"1udby_rXigLWz3XqXdJ9erK1hVtodwp6x","reverso_id":"1bojCL339Tsp7SAyyPMH_jJExuCtE7oTS"},{"dui":"05628249-8","frente_id":"1fr7tcbmZcYtjsBUTaXIB0wg4hc9UJL9O","reverso_id":"1Eo-F9vm2gAyGVGRVPh4FFrf0zGKCfUNf"},{"dui":"00149941-4","frente_id":"1WWHyleysJutQY0X4_I04rmUXFM1cAJSg","reverso_id":"1p5HRycQgRo-15dcvDj7st3k9s8ZOh04-"},{"dui":"06148159-4","frente_id":"1ck4mC30PegsI8sjaTRf28Evfm6oZNLz0","reverso_id":"1AULX0P6B9kNlmh-x8RVrGwxyxqjNjvkS"},{"dui":"05117000-2","frente_id":"1Zudytb5AoMPU-cX4-onjl8RN3nJMSl3G","reverso_id":"1RKTsNveVwrCXaw6uQX3TkPsbVq2xKvr7"},{"dui":"06080486-2","frente_id":"13AqQwf_WdjNe4YRmuLACZeDwDbne-5sf","reverso_id":"166R3P6hwWnFEW0PX6FHs1f_litYQbr8r"},{"dui":"04309081-6","frente_id":"1YOuRodc3Kbvp8cBJtO0qPCqlVPpY21Ee","reverso_id":"1l9j6DC3rOZDrqiZX8epQgNopnLanAxuU"},{"dui":"03635853-8","frente_id":"1XD03fe-vlKZSAtbXyiOFWepmpzNioEqM","reverso_id":"1wMbq17o84qQIu2xUVArODZ-YFEx8eELn"},{"dui":"05709340-2","frente_id":"17xdx6Z0DBIqARUUEZU_103G_er0l76E2","reverso_id":"1U-_tcAvb0hYwRVYzEMVG6ZG2qFlH6WGD"},{"dui":"05995282-2","frente_id":"1alyoqJeWE5_joTzrS6MgQtd93kmk9nJS","reverso_id":"1mjpvohTbzELbiDkAKUk10pwe6ecSVxPs"},{"dui":"05522895-4","frente_id":"15zecDS1iOXJN0R4Zm-0TVwkp43X-KZY0","reverso_id":"1ZJIwd_XB9RHtCruD_xyEwtsuKhRhe9fy"},{"dui":"04609503-5","frente_id":"11pl2J-8IZIJIDLlv9QpL71upG5YI6EBo","reverso_id":"1w0MPrw0GBsJZehmU1d1gEKaqUaZfsUqU"},{"dui":"06194668-3","frente_id":"1aNzP7_-PN2WFzPee_lT5Ay7WHDFecowA","reverso_id":"11O8ttpHE1X5kHxU5Sbrv0In6N09nbLh1"},{"dui":"05923412-7","frente_id":"1TS3FrH1u3QzKgAZPlV81Ppy2OsEWTv8n","reverso_id":"1i9bnOlqpks5eHsZLZD9z_cTLZFvUePzS"},{"dui":"05546079-2","frente_id":"14a0PIBoLhnk4aNmkBOwyEr9hDv1cd6TM","reverso_id":"1V_7MFFv4jsLFom79OukVlPncv8vKwf7W"},{"dui":"05811741-1","frente_id":"1XoRb00ittQbqyHq0o32zcEU_1EFMBzj2","reverso_id":"1HVupzBpxGIrX_Gq7CKBItLl4GGM-wdCK"},{"dui":"07553781-0","frente_id":"1x5t3dAX6A4D2j3-yS1YZMZvfuwKLsG22","reverso_id":"15_0TglEtJZNlwKYvlG-poxWBdTr9JyYG"},{"dui":"05422639-9","frente_id":"1XDyNs-guDQ8twNbFEN6eKVLwGj56Ld_k","reverso_id":"1jsdYOwrgVov9jyJWQbEKkoAEGjw3-kb_"},{"dui":"05429588-5","frente_id":"1D61Jpf7ie11tOityo70HjGInCbC-A8HB","reverso_id":"1ZLmIVPZLmSzWCn2qzgb84plqIZnttY8h"},{"dui":"03770961-9","frente_id":"1IKMNIHoFTlNlPiiIW687nP1jEVmo647l","reverso_id":"136R_AtFBuw_OLUe9yY3bttzehACOVDg-"},{"dui":"04382519-8","frente_id":"1skOIHJftCTjYVOPSBa7TCM9Q6_gjzn8H","reverso_id":"1dblRCGFf6UbIMka2Ak7vjy28Y25oF4-G"},{"dui":"05804392-1","frente_id":"1ol7-lwNC4luVFHqO0qkwoyzGj2ptPf1r","reverso_id":"1rxUm9Phc9QY1d7DIwQxGyubwJgtIfEag"},{"dui":"06025965-1","frente_id":"16v1BrJbApZExhaZdPtkGMaN6Fwa5z9VG","reverso_id":"1e4Xm58IAofCxJ99oKtKkKteuxOnFNwTp"},{"dui":"03348057-2","frente_id":"1njuQ20Rr4yCM3lm521US0NvZsbUxfCox","reverso_id":"1IM-U2NjcDNMnV2NwLKtIydEDaTzHeg9Q"},{"dui":"04138351-4","frente_id":"161D6ttE7agW_pMrEFQkG7KS48lJgnIdb","reverso_id":"1iJKpz20yzTjT2DDzrNvpHfOpBgygJ5uK"},{"dui":"06138787-1","frente_id":"1tvbEOusNaquhLPY-aB5-HAspwKRwc-mY","reverso_id":"1EHer0VKZ_pwNjWz-nwm_aXtBnc0g4byi"},{"dui":"01928861-5","frente_id":"1g0Ii4J1MUduEsINU8dw1KLZni3VVLz16","reverso_id":"1sfoOrN81Lcp5q8xbqbsecddIRmyfr99Y"},{"dui":"05461368-5","frente_id":"1xjlR8aEDQVfJzeobvP1XjK0AUN6NLb_W","reverso_id":"16xOnhG2M6gPWXc6ZuScYleOtX04G5oVt"},{"dui":"06142228-1","frente_id":"1SbP-WVZcczdILE4SB0j9hFvNgfhgGPes","reverso_id":"1XvJMPhZ2MrZOp7wqZ5Q8cyTmhf5d35NV"},{"dui":"04886673-3","frente_id":"1mRMuWRjNf9cGcyZmiFErSfBU8dyfUw1b","reverso_id":"1YX7X7epl9mVmBGNIVqAgjvjRAy9bRIHk"},{"dui":"06415215-2","frente_id":"1b6Z_C0-MAdT5JqXgEd1cNlTqQ8iWMn1D","reverso_id":"1i5ezJKtahvJlkXzW0wtqZiHf-G1wzwku"},{"dui":"05923637-3","frente_id":"1wFI_Ieuq2SyWLKNbIzXZa3G8OWEfXkh3","reverso_id":"199grZJQYduuD5Cui_0dHdcM1RgjBO9Ht"},{"dui":"05319009-0","frente_id":"1U3qdR24GXlvlPjlf03mLGbs5VemA0CsB","reverso_id":"10tgptB1JOm2hOyShVaXLtNs-tleun_WM"},{"dui":"06376306-5","frente_id":"1NwDKzNHVKhGCcQ2mBSG3OWipxbpfPD8v","reverso_id":"1O-tglO4fbGGjVdoBaXHeC5x6BDlXWJ5U"},{"dui":"04769758-9","frente_id":"1TWW4kDEka0KBHyfOyKV1PHcCHbbkQY-i","reverso_id":"1G2cto65RN8IztW1Cdra6a500APaALPkx"},{"dui":"06424878-3","frente_id":"1veSTt22OnbGaN1Zr9lG2Hhli3ybD4Bbf","reverso_id":"1u_zFpmG1LIwcs96Beio4rroxOrIhaD1h"},{"dui":"06255535-4","frente_id":"1oxTNDyGt6VBUla4TZfABikXon0-lyDww","reverso_id":"1HGaQfHsN48vZ0wEZoiCak7rBaSGJLLwa"},{"dui":"06831279-6","frente_id":"1DNlN6mb4WnVxuqyBUyrybhTiK3a1McnX","reverso_id":"1hsKTsPGotrOvKT5Jk_l34JyvZEFcgcbm"},{"dui":"05978815-0","frente_id":"170hu3SU9VC8ZB4wrK7gl22db-NJG2Qwu","reverso_id":"1wDJtjinrFwMDUQ3eOEOR9ST6-r-b3RV8"},{"dui":"06336945-5","frente_id":"1WV1FGdWSvucXYMEpO0cUyvag_UFJbhql","reverso_id":"1KsiBbJCGrO5fmSeWJh2VrC2gimzmfWT4"},{"dui":"05581289-2","frente_id":"1G-TvT8b4-BuHZpBwN6kByzWID0Zr07-0","reverso_id":"1igksDGZstImDbAH275C-EoatgcNuPz0U"},{"dui":"06766070-6","frente_id":"1jb85WllNJ_hlTEhpEl2E1doibepCwZ8M","reverso_id":"1RumnWS4KDif1aQ_EI5N0SKm1Hx20SnBZ"},{"dui":"05730972-2","frente_id":"1cQws_tm3fftMB-gm3s9ACNKueXfIPgYH","reverso_id":null},{"dui":"06362452-0","frente_id":"142wM4vxuzsmXoUlMNaYUI0kPUdAwXTnN","reverso_id":"1DI9MNWouW_iKpnsvZ_6PwF7kkIrGM7Kf"},{"dui":"05831813-0","frente_id":"1OaewqnGJTF8Hp0i-x-dw77qYmzmJnIVq","reverso_id":"1p6LXgadfp2ohr1iFG3FNyDMCd9D-Yf8E"},{"dui":"01926362-3","frente_id":"1E4klWFrH-MGNBZdc_dFvY1ave90Yp6oR","reverso_id":"1WRC2SzAFoAGkmDv7lWd2BRexpKqAlAFG"},{"dui":"05071559-0","frente_id":"1Wf211Z9HNKTeIfEVuB1qNjo1GZLGIujg","reverso_id":"1yvIiUqjo-W01O8iJ10liiR9BNkvRowHD"},{"dui":"06194718-4","frente_id":"11G23wzBtPXglIGrxeSasWkzrq-SLsDhW","reverso_id":null},{"dui":"06516600-7","frente_id":"1VgzeYuaS0QeHv0lblWJUOlRhuWy2Ghs6","reverso_id":null},{"dui":"06312755-2","frente_id":"1VCWHgWCtOqOiqPg1AEQVu84Y_teGAUwH","reverso_id":"1eoOLdgakx966WnW3PQjBXedl8JtTqhmR"},{"dui":"06630366-0","frente_id":"11l3agm9Crx-PB2FhrvoSRg7NxL2Egx79","reverso_id":"1NDLxaMBDuWnJFzt8DPSzubqRr6Tdzn9p"},{"dui":"06439851-2","frente_id":"1677sAuyGBVPKDag9lz4ILrVVuyF2M2or","reverso_id":"16I_P7gsprRlE7aK66rbF6r1FEYWtytJU"},{"dui":"05783140-2","frente_id":"1u6_OwR6PFDlv7YRZbRnT_JsPJmepXw1w","reverso_id":"1kVwF0sBP63Uma0OnmZ03KSO6OZGzKLOb"},{"dui":"05463205-3","frente_id":"19giUXxsxrUz8w9AEKEXbBDDmGrN0TyEq","reverso_id":"1Z4up7e62BCtN4z3PdqRJrcePE_sY6Nmt"},{"dui":"06195871-1","frente_id":"1_qz3AVJ9MhkJSCQwNjK4wz0b40924gEf","reverso_id":"14NpFLudw7L3Ydx8S2eozDOgjKv5yEqv6"},{"dui":"06455767-9","frente_id":"1wtE6sowen-ElOLItnLUmShWPrAnJQoCL","reverso_id":"1uKvqUbhSshNGKlQjirlwOtNZ5XC1KRle"},{"dui":"06294082-6","frente_id":"1QCKEkL7IgY2E0BZ6tHSVvnrylExYBGKJ","reverso_id":"1lQEYARHDHnj1atqqiRLtq9hr1300YgoG"},{"dui":"06232884-6","frente_id":"1LdyiQGMrL6DENBpF2kFUjhTbIdEfD5Lx","reverso_id":"1dFv15vTiCetshg3GaHBfdGFK8_1RH4pk"},{"dui":"06703681-8","frente_id":"1du5PzbBIkYQrUx8tHzfdgYb22fq2KZol","reverso_id":"1Ez4Siz0QvZLNpsuTbnqyoR-OSL-tHt72"},{"dui":"05367367-4","frente_id":"1xNqs74BGsS9RkozezvE8N7RpuSlFthls","reverso_id":null},{"dui":"06147859-1","frente_id":"15Kkes-jNaINHDMhfASirkwZyPb5HMiRY","reverso_id":"1_RnxX0HdPQdmhrjuHqCwbbuysXUIltv7"},{"dui":"06200773-3","frente_id":"1Iu8bEsf-2OHaV32yf0Ow-Xab59krodlk","reverso_id":"1laBKFMW9ZUO1hbfUPUR3VigIFRDx7Prj"},{"dui":"05969231-7","frente_id":"1NQbmX_FDaiQu40BpcQDRBnbFxQC4_Tv-","reverso_id":"13IOu169phTaT23NrT7D6f-FRoz8ZwosV"},{"dui":"06061211-8","frente_id":"1p4nZDTKMEFY48qI1SAA_PXJZyWL9-44R","reverso_id":"1FP809PmfXT3SaSSWWLSGNLftcCeXHCvC"},{"dui":"06003472-6","frente_id":"1K3n_nXzMdQ6R8wyqlF_pNp60jIJq8UlB","reverso_id":"1O-5z9WVZZSmPdxYMBwV6kDzvvK-CY5xa"},{"dui":"01597703-4","frente_id":"1R8qbDovJ3nioaDdO-V3ou6iFnTN5qzHo","reverso_id":"1VwOy5TrieG31KDFrPXivx-zU2xakbCHF"},{"dui":"06203560-5","frente_id":"1ISs4sUOEZjoELn8TBlExz2bFVQUd34yK","reverso_id":"1BPVDRMhxAdKnEJVyHe0_f44rNHQ8gsDC"},{"dui":"02006155-5","frente_id":"1XdYAS1aTiJBIMik-eeGob3tj_SWvCAAT","reverso_id":"1bbKXln8kT2YgzSpe8IENSKj8z0uV7lYj"},{"dui":"05929063-6","frente_id":"1I_f2s_DbxJcYqwzqPf-WmmUmr6I_-qMS","reverso_id":"1TZ8BLWtW6bH0JR5cqH3TBzS2Obq6-IuK"},{"dui":"06361714-1","frente_id":"1Ds1irDCRpLzUzsSDhqRht0X97T07C5DA","reverso_id":"1kiiHnEVF9hn1Pv5nmVz0YMd233iX4J6S"},{"dui":"05417875-8","frente_id":"1ucT6Ji_aVHwdizRHXsswBVbn97oI9Gn2","reverso_id":"1UXElBtF8qkNykuNL2MASeHPzWCKttiPj"},{"dui":"01918490-0","frente_id":"1cGTe4EqEgEjdXZ_sBArzspanoTLApnkt","reverso_id":"1EUO3dOiol4pscepK--vl1dFQC6GjqYXg"},{"dui":"06245119-4","frente_id":"1wkV_R5HtzepJ-ssW91UTXZedtvYG56aA","reverso_id":"1fdIAZwUmJfOAD_Jke2H7Dn7auaXh0PDT"},{"dui":"06847290-2","frente_id":"1s0-yTlZZW1KP_ZeFgOTEvJgE1_TaepWc","reverso_id":"1RpkWSZer2wV2llZ1SnT6-GHRErgCJEa_"},{"dui":"00673015-8","frente_id":"13_xxt9GabA6i4VPby_Ds8xaU122j_Xdu","reverso_id":"1da5UF2SFpPENySrKKYp9qxWtY2F_TZvL"},{"dui":"05989803-6","frente_id":"1GXB7PHagWJwC0AXNFgJtu5S8G5nwNLjN","reverso_id":null},{"dui":"06059098-4","frente_id":"15FoUlc_cUj-l5slIv5PF0PQJDC8-zKDf","reverso_id":"1TYBNLE6tcMPrGJu68jNadN1hN03caWAM"},{"dui":"05987384-0","frente_id":"1XwD8Uwmk-1n9G7cvLw49fTfMmxqMoraq","reverso_id":"1x9iH390RYArLQCgqu-VJF00tBfsND9MV"},{"dui":"06598277-0","frente_id":"1XAJE7f4fpbyqW1pnhfgM86EL6r-Am6K_","reverso_id":"1ZFwy0jXLq6zB64sjZ2xIuOwip8xG-u3h"},{"dui":"02203223-5","frente_id":"1I_NWlTBR981y2PgFYkXbQ37u5I-qtMPF","reverso_id":"1Ti3Afd1rAYJ1En5fDxbrjAOYDajbwqkA"},{"dui":"04122331-6","frente_id":"1OGkTBpi3rC6lin1cA4LYoESyOi8aDy4m","reverso_id":null},{"dui":"00201352-0","frente_id":"19l3fRDVVtKFEVClnyspsnBNMdBRtNKqs","reverso_id":"1lIszn0mfgXVhJtuJ9S6ZlDexbLRm7t1b"},{"dui":"05748310-2","frente_id":"12wrZqS-25qP5zXbyE45OauZTD210zcCR","reverso_id":"1AmdNjqmgjdrynHNpVC7Pz56wDGPXjrab"},{"dui":"06360173-4","frente_id":"1BpyhH3G0-qi2w4z-163hqCOOd-db7C1i","reverso_id":"1-Re_-RxBQSitycRqKstSjDiTY1p8Tkb5"},{"dui":"06990394-8","frente_id":"1L2d0ytRiu41gsC_0jBI78cMuphvygoGz","reverso_id":"18pSwx4vGDpJ2RlMBB_KcrVkb4fOF4VxT"},{"dui":"05985703-0","frente_id":"1L-opzvQAWfZOLZbS_a_wSzMnITZkB-KN","reverso_id":"1yofd2h8iswe9SNCGqZlPFoHzJpMl5EEo"},{"dui":"06004594-7","frente_id":"1341ckr5G4tqHyXHYS0bvnTP78KWzKv3A","reverso_id":"1E4S44TZtmY-oRRPRPz0WQnDJ1zCFtKKS"},{"dui":"06053305-5","frente_id":"1x7N7Ot1a71tbHugloAaJUeS17h7q3cIz","reverso_id":"1tVJCYUV5uwvm_E46qPAzkifhAIBUvcsl"},{"dui":"06204811-1","frente_id":"1aNugWlABJuJPDfE5ajNhlqc3kJQ9OwbL","reverso_id":"1iVGfNxMyifmM3H0hA2SSrikUYdFGTbY5"},{"dui":"05423780-3","frente_id":"1ahMF_HZTiY16-VK_sqzIIVdyq2mlTQgM","reverso_id":"16wCTzsHlxxYqehAFJ0rsUhyQnmMNXfjS"},{"dui":"05804808-6","frente_id":"12gQEz-_Yq7h9iXe1jSD6GqrD3MWlk8sf","reverso_id":"1G_daIJyfm5NtBoIop1o7RXXbHMLHNdKx"},{"dui":"06048394-1","frente_id":"1B2zYanws8ayyjegEl_tpz29k8UckUBkY","reverso_id":"1yZN1XBvru5AAq8BUL6IttP-3aUdYE2xl"},{"dui":"06732391-4","frente_id":"1RGVMKr-Ppe_TrWeU-8CRlF1dVl2V_r4Y","reverso_id":"1HE54Gz0Fo8gd0r1TuIRBKMBJsT3A5pKw"},{"dui":"04939615-5","frente_id":"1RKBq5Qgk_2JYd0lt-DfXp--LIzUCQ56u","reverso_id":"1cVXIzKHgBDoy3roTKyCdkARbGn3tms6S"},{"dui":"06788525-9","frente_id":"1FdaK-ALS4B2Dfz2JjNvMbZZF8A4LGwjR","reverso_id":"1-Cvz6XA4V79RQsY4nznoeIuzQNtDux8D"},{"dui":"06559601-6","frente_id":"1MncnE0GrAHLwjKNRJRjqnCevSGdr8WU8","reverso_id":"1Zu_J2kGpV0PZCPJbUqWNT8oCD9KQhPB8"},{"dui":"06248897-1","frente_id":"1s1W_UbQ7sv88vaaZ4vEDpn21zYZyhwyA","reverso_id":"1lBxXQFxPk4RtDU81Ld9gKOVNotqZM_3L"},{"dui":"07807448-9","frente_id":"1tiOLvJKWmvARAQRiIc2d7dGDFge0ssX2","reverso_id":"1V2dFtYrsXTIBBfl7FJNMuoj7EX0HliGU"},{"dui":"06825029-5","frente_id":"1G2flG6vPuZYItR42HG904zZW_bfgozr5","reverso_id":"1hrDHAcTCy2v05NTdHr4yrv4tOF0n4BCY"}]

type Estado = 'pendiente' | 'procesando' | 'ok' | 'error'
interface Resultado { dui: string; estado: Estado; detalle?: string }

export default function ImportarPage() {
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [corriendo, setCorriendo] = useState(false)
  const [terminado, setTerminado] = useState(false)

  async function iniciarImportacion() {
    setCorriendo(true)
    setTerminado(false)
    setResultados(REGISTROS.map(r => ({ dui: r.dui, estado: 'pendiente' })))

    for (let i = 0; i < REGISTROS.length; i++) {
      const reg = REGISTROS[i]

      setResultados(prev => prev.map(r =>
        r.dui === reg.dui ? { ...r, estado: 'procesando' } : r
      ))

      try {
        const res = await fetch('/api/importar-fotos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reg),
        })
        const data = await res.json()

        setResultados(prev => prev.map(r =>
          r.dui === reg.dui
            ? { ...r, estado: data.ok ? 'ok' : 'error', detalle: data.error }
            : r
        ))
      } catch (err: any) {
        setResultados(prev => prev.map(r =>
          r.dui === reg.dui ? { ...r, estado: 'error', detalle: err.message } : r
        ))
      }

      // Pequeña pausa para no saturar Google Drive
      await new Promise(r => setTimeout(r, 300))
    }

    setCorriendo(false)
    setTerminado(true)
  }

  const ok = resultados.filter(r => r.estado === 'ok').length
  const errores = resultados.filter(r => r.estado === 'error').length
  const procesando = resultados.filter(r => r.estado === 'procesando').length
  const pendientes = resultados.filter(r => r.estado === 'pendiente').length
  const pct = resultados.length ? Math.round((ok + errores) / resultados.length * 100) : 0

  return (
    <div className="p-6 max-w-4xl space-y-5">

        {/* Info + botón inicio */}
        {!corriendo && !terminado && (
          <div className="card p-6 space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg" style={{ background: 'var(--azul-light)', border: '1px solid #bfdbfe' }}>
              <Download size={20} style={{ color: 'var(--azul)', flexShrink: 0, marginTop: 2 }} />
              <div className="text-sm" style={{ color: 'var(--azul)' }}>
                <p className="font-semibold mb-1">Se importarán {REGISTROS.length} registros</p>
                <p>Las imágenes se descargan de Google Drive y se suben directamente a Supabase Storage. El proceso tarda aproximadamente <strong>1-2 minutos</strong>. No cierre esta página mientras se ejecuta.</p>
              </div>
            </div>
            <button onClick={iniciarImportacion} className="btn btn-primary w-full justify-center py-3 text-sm">
              <Download size={15} /> Iniciar importación
            </button>
          </div>
        )}

        {/* Progreso */}
        {(corriendo || terminado) && (
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">
                {corriendo ? 'Importando fotografías...' : '¡Importación completada!'}
              </span>
              <span className="text-sm font-bold" style={{ color: corriendo ? 'var(--navy)' : errores > 0 ? 'var(--amber)' : 'var(--verde)' }}>
                {pct}%
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 10, background: 'var(--fondo)', border: '1px solid var(--borde)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: errores > 0 && terminado ? 'var(--amber)' : terminado ? 'var(--verde)' : 'var(--navy)' }} />
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Correctos', value: ok, color: 'var(--verde)', bg: 'var(--verde-light)' },
                { label: 'Errores', value: errores, color: 'var(--rojo)', bg: 'var(--rojo-light)' },
                { label: 'Procesando', value: procesando, color: 'var(--azul)', bg: 'var(--azul-light)' },
                { label: 'Pendientes', value: pendientes, color: 'var(--texto-muted)', bg: 'var(--fondo)' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className="rounded-lg p-3" style={{ background: bg }}>
                  <div className="text-xl font-bold" style={{ color }}>{value}</div>
                  <div className="text-xs mt-0.5" style={{ color }}>{label}</div>
                </div>
              ))}
            </div>
            {terminado && errores === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'var(--verde-light)', color: 'var(--verde)', border: '1px solid #a7f3d0' }}>
                <CheckCircle size={15} /> Todas las fotografías fueron importadas exitosamente a Supabase Storage.
              </div>
            )}
            {terminado && errores > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
                style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid #fde68a' }}>
                <AlertTriangle size={15} /> {errores} registros fallaron. Revise la lista para más detalles.
              </div>
            )}
          </div>
        )}

        {/* Lista de resultados */}
        {resultados.length > 0 && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
              style={{ background: 'var(--fondo)', borderBottom: '1px solid var(--borde)', color: 'var(--texto-muted)' }}>
              Detalle por registro
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {resultados.map(r => (
                <div key={r.dui} className="flex items-center gap-3 px-5 py-2.5"
                  style={{ borderBottom: '1px solid var(--borde)' }}>
                  {r.estado === 'pendiente' && <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'var(--borde)' }} />}
                  {r.estado === 'procesando' && <Loader size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--azul)' }} />}
                  {r.estado === 'ok' && <CheckCircle size={16} className="flex-shrink-0" style={{ color: 'var(--verde)' }} />}
                  {r.estado === 'error' && <AlertTriangle size={16} className="flex-shrink-0" style={{ color: 'var(--rojo)' }} />}
                  <span className="font-mono text-xs flex-1" style={{ color: 'var(--texto-2)' }}>{r.dui}</span>
                  <span className="text-xs" style={{
                    color: r.estado === 'ok' ? 'var(--verde)' : r.estado === 'error' ? 'var(--rojo)' : r.estado === 'procesando' ? 'var(--azul)' : 'var(--texto-muted)'
                  }}>
                    {r.estado === 'pendiente' && 'En espera'}
                    {r.estado === 'procesando' && 'Descargando y subiendo...'}
                    {r.estado === 'ok' && 'Importado correctamente'}
                    {r.estado === 'error' && (r.detalle ?? 'Error al importar')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  )
}
