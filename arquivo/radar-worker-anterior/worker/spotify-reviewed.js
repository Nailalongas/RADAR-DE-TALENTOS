// Reversible, Spotify-only queue review. Never changes Radar registries or history.
const SPOTIFY_REVIEWED_LINKS=[
 {name:'Junior',aliases:['Junior','Cantor Junior'],artistId:'1Ep9fDiLZonyJc2zDPHiwl',profiles:['UCO0pXFdhOPbsEBuHVMyulMQ'],sources:['https://www.youtube.com/watch?v=fpgqhidFMrg','https://open.spotify.com/track/3YObY13UyjwkAsD2Qbc14k']},
 {name:'Felipe Junior',aliases:['Felipe Junior','Cantor Felipe Junior'],artistId:'2hbHVHuIzFOuE2CAhQFOuJ',profiles:['UC1h57XuVF8jc0quApoMcwWw'],sources:['https://www.youtube.com/channel/UC1h57XuVF8jc0quApoMcwWw','https://linktr.ee/cantorfelipejunior']},
 {name:'Daniel',aliases:['Daniel','Daniel Oficial','DanielVEVO'],artistId:'2wwWukJBsCikjlj7vlbQkM',profiles:['UCZ9yRhwZxdiz6kF09quMZHQ'],sources:['https://www.daniel.art.br/','https://www.wikidata.org/wiki/Q5216314']},
 {name:'Leonardo',aliases:['Leonardo','LeonardoVEVO'],artistId:'2YWOP324cKGfkTo2PydgJR',profiles:['UC2_TCsE7cs01PTbOrlPnCqg'],sources:['https://leonardo.art.br/']},
 {name:'Felipe e Rodrigo',aliases:['Felipe e Rodrigo','Felipe & Rodrigo'],artistId:'7gZu6kPnY9enEi5FvgTO4F',profiles:['UCdaaMVXWVQXGt97oh7fadIw'],sources:['https://www.felipeerodrigo.com.br/','https://linktr.ee/felipeerodrigo']},
 {name:'João Gomes',aliases:['João Gomes','João Gomes Cantor'],artistId:'4JNo6Q5KdcRf1vtSX9mB0S',profiles:['UCIW4y9tEpVmx_iezUVA9blQ'],sources:['https://open.spotify.com/artist/4JNo6Q5KdcRf1vtSX9mB0S','https://www.youtube.com/channel/UCIW4y9tEpVmx_iezUVA9blQ']},
 {name:'Netto Brito',aliases:['Netto Brito'],artistId:'1slHyPE5gIYlHAKLiLv9PU',profiles:['UCWTL-TU_Dkq6Rpsmwxe2RSQ'],sources:['https://bio.nettobrito.com.br/','https://open.spotify.com/album/62HBlVEG40caLUl0TOYJhk']},
 {name:'Zezo',aliases:['Zezo','Zezo Potiguar','Zezo - Oficial'],artistId:'5R18GNmvBWGTfBAG0Xy8WT',profiles:['UCFRfWDGyzhLJAk0Lkbf2kDg'],sources:['https://linktr.ee/ze.zo']},
 {name:'Washington Brasileiro',aliases:['Washington Brasileiro','Washington Brasileiro Ao Vivo'],artistId:'64mc7RyoN5KDwALxbpdWLP',profiles:['UCaGhecql2HclGTL8N2ELmAA','UCapaBuThroDYbMwojDANXxw'],sources:['https://www.palcomp3.com.br/washingtonbrasileiro/']},
 {name:'Doppe & Kokke',aliases:['Doppe & Kokke'],artistId:'7hFvKdRcluwievforOsBqZ',profiles:['UCMB5YzJ5JTSU8eb9bqfeOhg'],sources:['https://doppekokke.com/','https://www.youtube.com/channel/UCMB5YzJ5JTSU8eb9bqfeOhg']},
 {name:'Get Worship',aliases:['Get Worship'],artistId:'5ZynjHkFMZINvXZm7DD4Yp',profiles:['UCQRNBXeiOQqdg4z3Fs2xw-Q'],sources:['https://open.spotify.com/album/2Yp2nLMhdE4nXqL2NDYI8M','https://www.youtube.com/channel/UCQRNBXeiOQqdg4z3Fs2xw-Q']},
 {name:'Shunned at a Funeral',aliases:['Shunned at a Funeral'],artistId:'0C1z7vr9MlptElxOso78nP',profiles:['UCFTDtkInVFmsTejD8Wj7PKA'],sources:['https://www.shunnedatafuneral.com/']},
 {name:'Whindersson Nunes',aliases:['Whindersson Nunes','whinderssonnunes'],artistId:'2emd6h8cx0U8QUAxDddXPF',profiles:['UC3KQ5GWANYF8lChqjZpXsQw'],sources:['https://open.spotify.com/album/6W0bJ8r0GjWbmHcsbldYna','https://www.youtube.com/channel/UC3KQ5GWANYF8lChqjZpXsQw']},
 {name:'Maisa',aliases:['Maisa','Maisa Silva'],artistId:'2dASB2R6rncCO9zBHLyuW2',profiles:['UCamIJYAJJGmfpT8N1-q6eug'],sources:['https://open.spotify.com/track/00uhQpGHaR3FUyF5VYTCLr','https://www.youtube.com/channel/UCamIJYAJJGmfpT8N1-q6eug']},
 {name:'Serginho Lacerda',aliases:['Serginho Lacerda'],artistId:'7ztnwtCOqqCikwSonS2u71',profiles:['UC4K6HeU8Mv5Cb0joT1uYKKg'],sources:['https://open.spotify.com/track/043gb7YE52AozimpcR9QZz','https://open.spotify.com/album/7xcv5VAawNeaMHfRyzNBTG','https://www.tribunapr.com.br/blogs/luiz-antonio/leis-do-avesso-na-fnac/','https://serginholacerda.com.br/']},
 // Verified against registered channel metadata and Spotify oEmbed.
 {"name":"Clayton Queiroz","aliases":["Clayton Queiroz"],"artistId":"225heaA0eolmtY4YIGdByA","profiles":["UCgMMQllXCS__tXxGhhiIpXA"],"sources":["https://www.youtube.com/channel/UCgMMQllXCS__tXxGhhiIpXA/about","https://open.spotify.com/artist/225heaA0eolmtY4YIGdByA"]},
 {"name":"Drops INA","aliases":["drops","Drops INA"],"artistId":"0KKcTiB0jc5ZWK1a0JfuUh","profiles":["UCrLIxbu4J7kJKdMZOmpfC-w"],"sources":["https://www.youtube.com/channel/UCrLIxbu4J7kJKdMZOmpfC-w/about","https://open.spotify.com/artist/0KKcTiB0jc5ZWK1a0JfuUh"]},
 {"name":"Marília Mendonça","aliases":["Marília Mendonça"],"artistId":"1yR65psqiazQpeM79CcGh8","profiles":["UCwfEOn0O1DWcyTgzVVu28ig"],"sources":["https://www.youtube.com/channel/UCwfEOn0O1DWcyTgzVVu28ig/about","https://open.spotify.com/artist/1yR65psqiazQpeM79CcGh8"]},
 {"name":"Panda","aliases":["Panda Cantor","Panda"],"artistId":"5qIpstBGrGteJZg1xIvbiz","profiles":["UCpxck6bZZZ44S7VcKZ1Ub9A"],"sources":["https://www.youtube.com/channel/UCpxck6bZZZ44S7VcKZ1Ub9A/about","https://open.spotify.com/artist/5qIpstBGrGteJZg1xIvbiz"]},
 {"name":"Marina Elali","aliases":["Marina Elali"],"artistId":"77Wl6L20WG41VO6pqpHrkL","profiles":["UClvxdljrUTjP53QKlxL_jqg"],"sources":["https://www.youtube.com/channel/UClvxdljrUTjP53QKlxL_jqg/about","https://open.spotify.com/artist/77Wl6L20WG41VO6pqpHrkL"]},
 {"name":"Theuzinho","aliases":["Theuzinho Cantor","Theuzinho"],"artistId":"5S7nhltEOIHhyXPETyKewy","profiles":["UCyPw7nYWFQ4kS9GdcZKKFUg"],"sources":["https://www.youtube.com/channel/UCyPw7nYWFQ4kS9GdcZKKFUg/about","https://open.spotify.com/artist/5S7nhltEOIHhyXPETyKewy"]},
 {"name":"Barbatuques","aliases":["barbatuques","Barbatuques"],"artistId":"5xnMjuPp1eDXa8du0SKIHD","profiles":["UCWiT9kFZixWURbrDUFE7DRw"],"sources":["https://www.youtube.com/channel/UCWiT9kFZixWURbrDUFE7DRw/about","https://open.spotify.com/artist/5xnMjuPp1eDXa8du0SKIHD"]},
 {"name":"Tayara Andreza","aliases":["Tayara Andreza"],"artistId":"0N78z4PhvpchRlJhXNVrKh","profiles":["UCg9nWuUISG69Hv2VaCrE72w"],"sources":["https://www.youtube.com/channel/UCg9nWuUISG69Hv2VaCrE72w/about","https://open.spotify.com/artist/0N78z4PhvpchRlJhXNVrKh"]},
 {"name":"Ana Castela","aliases":["Ana Castela"],"artistId":"2CKOmarVWvWqkNWUatHCex","profiles":["UCRD1ypvmK7e_05Rtu9zHOfQ"],"sources":["https://www.youtube.com/channel/UCRD1ypvmK7e_05Rtu9zHOfQ/about","https://open.spotify.com/artist/2CKOmarVWvWqkNWUatHCex"]},
 {"name":"Anitta","aliases":["Anitta"],"artistId":"7FNnA9vBm6EKceENgCGRMb","profiles":["UCqjjyPUghDSSKFBABM_CXMw"],"sources":["https://www.youtube.com/channel/UCqjjyPUghDSSKFBABM_CXMw/about","https://open.spotify.com/artist/7FNnA9vBm6EKceENgCGRMb"]},
 {"name":"LUDMILLA","aliases":["LUDMILLA"],"artistId":"3CDoRporvSjdzTrm99a3gi","profiles":["UCSCB1IQUmNa8Gn5VfSUAUpg"],"sources":["https://www.youtube.com/channel/UCSCB1IQUmNa8Gn5VfSUAUpg/about","https://open.spotify.com/artist/3CDoRporvSjdzTrm99a3gi"]},
 {"name":"GIULIA BE","aliases":["GIULIA","GIULIA BE"],"artistId":"0kjGPGtoyKwKVOZAKmv5K6","profiles":["UCs97Psn1u1lJcLW2OP9OyrA"],"sources":["https://www.youtube.com/channel/UCs97Psn1u1lJcLW2OP9OyrA/about","https://open.spotify.com/artist/0kjGPGtoyKwKVOZAKmv5K6"]},
 {"name":"Manu","aliases":["Manu Bahtidão","Manu"],"artistId":"0CdnnCbbKD4oIzBmxi2o7r","profiles":["UCTa_X-4mmje4Tk0lig9t4Mw"],"sources":["https://www.youtube.com/channel/UCTa_X-4mmje4Tk0lig9t4Mw/about","https://open.spotify.com/artist/0CdnnCbbKD4oIzBmxi2o7r"]},
 {"name":"Naiara Azevedo","aliases":["Naiara Azevedo"],"artistId":"0jD7VeE1m2SdHbOWeCtB9l","profiles":["UCOfSEIUbEcOCMGPGyMPv4fg"],"sources":["https://www.youtube.com/channel/UCOfSEIUbEcOCMGPGyMPv4fg/about","https://open.spotify.com/artist/0jD7VeE1m2SdHbOWeCtB9l"]},
 {"name":"Maiara & Maraisa","aliases":["Maiara e Maraisa","Maiara & Maraisa"],"artistId":"59jlthNnbmim5l9tmNA7se","profiles":["UCULzCZWkkOb9dW8rr6dguQQ"],"sources":["https://www.youtube.com/channel/UCULzCZWkkOb9dW8rr6dguQQ/about","https://open.spotify.com/artist/59jlthNnbmim5l9tmNA7se"]},
 {"name":"Ana Cañas","aliases":["Ana Cañas"],"artistId":"4v1mao101nIWvxzotCSKyz","profiles":["UCS1jh87Nl__BNTFryqyreEA"],"sources":["https://www.youtube.com/channel/UCS1jh87Nl__BNTFryqyreEA/about","https://open.spotify.com/artist/4v1mao101nIWvxzotCSKyz"]},
 {"name":"CINTIA FERSI","aliases":["Cintia Férsi","CINTIA FERSI"],"artistId":"1jMaki61FAa12qm6ep1EfE","profiles":["UCTWFd3u2Jvuyf7Y00YYGSVA"],"sources":["https://www.youtube.com/channel/UCTWFd3u2Jvuyf7Y00YYGSVA/about","https://open.spotify.com/artist/1jMaki61FAa12qm6ep1EfE"]},
 {"name":"GIANA","aliases":["GIANA"],"artistId":"4qB4n69ENaMdCb37AYd6wk","profiles":["UCkoJ9S5qYijio7YNurBwcpA"],"sources":["https://www.youtube.com/channel/UCkoJ9S5qYijio7YNurBwcpA/about","https://open.spotify.com/artist/4qB4n69ENaMdCb37AYd6wk"]},
 {"name":"Gloria Groove","aliases":["Gloria Groove"],"artistId":"7rXMvXRnWHaSwnVvPeUUfw","profiles":["UCLoL96fSeaLOen3mpDYeqtA"],"sources":["https://www.youtube.com/channel/UCLoL96fSeaLOen3mpDYeqtA/about","https://open.spotify.com/artist/7rXMvXRnWHaSwnVvPeUUfw"]},
 {"name":"Ivete Sangalo","aliases":["IveteSangalo","Ivete Sangalo"],"artistId":"7dzq55YG3wjViqexDwiycQ","profiles":["UCko8Sac2QJNCeKdGEcuKdKw"],"sources":["https://www.youtube.com/channel/UCko8Sac2QJNCeKdGEcuKdKw/about","https://open.spotify.com/artist/7dzq55YG3wjViqexDwiycQ"]},
 {"name":"Mariana Fagundes","aliases":["Mariana Fagundes"],"artistId":"63yBOaK3N1kG2g1M5ZxBox","profiles":["UC4yyFcwtsu1YQxu-iWwbwxA"],"sources":["https://www.youtube.com/channel/UC4yyFcwtsu1YQxu-iWwbwxA/about","https://open.spotify.com/artist/63yBOaK3N1kG2g1M5ZxBox"]},
 {"name":"Paula Toller","aliases":["Paula Toller"],"artistId":"5BQveHScm6btG6jfbxwyfs","profiles":["UCzvJ-MeLyJdk8_sl54I51LA"],"sources":["https://www.youtube.com/channel/UCzvJ-MeLyJdk8_sl54I51LA/about","https://open.spotify.com/artist/5BQveHScm6btG6jfbxwyfs"]},
 {"name":"Galícia","aliases":["Galícia"],"artistId":"79N95MiRQ5G55CtC7cVBsr","profiles":["UCv2a0Tia9n1kARcexZtIUKw"],"sources":["https://www.youtube.com/channel/UCv2a0Tia9n1kARcexZtIUKw/about","https://open.spotify.com/artist/79N95MiRQ5G55CtC7cVBsr"]},
 {"name":"Rionegro & Solimões","aliases":["Rionegro e Solimões","Rionegro & Solimões"],"artistId":"33NrinbbEctw1wsdKNgZeZ","profiles":["UCNpG2l1OT2dGCN8bHy_WO6A"],"sources":["https://www.youtube.com/channel/UCNpG2l1OT2dGCN8bHy_WO6A/about","https://open.spotify.com/artist/33NrinbbEctw1wsdKNgZeZ"]},
 {"name":"Zé Neto & Cristiano","aliases":["Zé Neto e Cristiano","Zé Neto & Cristiano"],"artistId":"487N2T9nIPEHrlTZLL3SQs","profiles":["UCRRu9OXVYd5clj2Bs29gUVQ"],"sources":["https://www.youtube.com/channel/UCRRu9OXVYd5clj2Bs29gUVQ/about","https://open.spotify.com/artist/487N2T9nIPEHrlTZLL3SQs"]},
 {"name":"Casa Worship","aliases":["CASA Worship","Casa Worship"],"artistId":"4bqKmu3kRUl6X7pTl1CuVs","profiles":["UC8JmlV43Vtjtuhba8VT_FCg"],"sources":["https://www.youtube.com/channel/UC8JmlV43Vtjtuhba8VT_FCg/about","https://open.spotify.com/artist/4bqKmu3kRUl6X7pTl1CuVs"]},
 {"name":"Bruno & Barretto","aliases":["Bruno & Barretto"],"artistId":"70x9rYb58QCNNeNxuO3StS","profiles":["UCPWqL6OWIZNO-dVm5euF-ng"],"sources":["https://www.youtube.com/channel/UCPWqL6OWIZNO-dVm5euF-ng/about","https://open.spotify.com/artist/70x9rYb58QCNNeNxuO3StS"]},
 {"name":"Guilherme & Benuto","aliases":["Guilherme e Benuto","Guilherme & Benuto"],"artistId":"6m6e7D2TnV0aYMllFFwMxu","profiles":["UCfG0o17SqRg8qAjlpTdxZag"],"sources":["https://www.youtube.com/channel/UCfG0o17SqRg8qAjlpTdxZag/about","https://open.spotify.com/artist/6m6e7D2TnV0aYMllFFwMxu"]},
 {"name":"Junior Marques","aliases":["Júnior Marques","Junior Marques"],"artistId":"5Q3lDwHhgRwL4pBWgXUSu3","profiles":["UCLRrucNaP2nd--3vzAKZJGQ"],"sources":["https://www.youtube.com/channel/UCLRrucNaP2nd--3vzAKZJGQ/about","https://open.spotify.com/artist/5Q3lDwHhgRwL4pBWgXUSu3"]},
 {"name":"Matheus Vargas","aliases":["Matheus Vargas"],"artistId":"61Y0yB7JKvkyHQ5g4Neirl","profiles":["UCr404qHfCmhpBBIvgtS6yLw"],"sources":["https://www.youtube.com/channel/UCr404qHfCmhpBBIvgtS6yLw/about","https://open.spotify.com/artist/61Y0yB7JKvkyHQ5g4Neirl"]},
 {"name":"Pedro Paulo & Alex","aliases":["Pedro Paulo e Alex","Pedro Paulo & Alex"],"artistId":"5zpNiDA9xLFWQfPCJOQNGN","profiles":["UCoVw1ho6U3AGidHm-k7vH-w"],"sources":["https://www.youtube.com/channel/UCoVw1ho6U3AGidHm-k7vH-w/about","https://open.spotify.com/artist/5zpNiDA9xLFWQfPCJOQNGN"]},
 {"name":"Diego & Victor Hugo","aliases":["Diego e Victor Hugo","Diego & Victor Hugo"],"artistId":"3k68C6mNMJL6OaAdWeW2ZF","profiles":["UCJZMKO4pCeNf8jVifCGxFjw"],"sources":["https://www.youtube.com/channel/UCJZMKO4pCeNf8jVifCGxFjw/about","https://open.spotify.com/artist/3k68C6mNMJL6OaAdWeW2ZF"]},
 {"name":"Murilo Huff","aliases":["Murilo Huff"],"artistId":"3hq7WoPJsrRP0KMSLhUgRz","profiles":["UCMZKcLkNw1AMgfusg3Mjutw"],"sources":["https://www.youtube.com/channel/UCMZKcLkNw1AMgfusg3Mjutw/about","https://open.spotify.com/artist/3hq7WoPJsrRP0KMSLhUgRz"]},
 {"name":"Leo Bueno e Julio Cesar","aliases":["Leo Bueno e Julio Cesar"],"artistId":"03WfSOY1QcUmQLJ8fC3qpM","profiles":["UC5BHVIUaxftl0vxLSdrDRyg"],"sources":["https://www.youtube.com/channel/UC5BHVIUaxftl0vxLSdrDRyg/about","https://open.spotify.com/artist/03WfSOY1QcUmQLJ8fC3qpM"]},
 {"name":"Danilo e Davi","aliases":["Danilo e Davi"],"artistId":"5DaqVKaxeqDbJuxaIP9m4u","profiles":["UCKIplktMY_yd3g9awcLWa6g"],"sources":["https://www.youtube.com/channel/UCKIplktMY_yd3g9awcLWa6g/about","https://open.spotify.com/artist/5DaqVKaxeqDbJuxaIP9m4u"]},
 {"name":"Adson & Alana","aliases":["Adson e Alana","Adson & Alana"],"artistId":"4xaPLqLqfarR3SyWFH2cbC","profiles":["UCMiCiifKZ4qvWUCybpbqJHw"],"sources":["https://www.youtube.com/channel/UCMiCiifKZ4qvWUCybpbqJHw/about","https://open.spotify.com/artist/4xaPLqLqfarR3SyWFH2cbC"]},
 {"name":"Diego & Arnaldo","aliases":["Diego e Arnaldo","Diego & Arnaldo"],"artistId":"0CrGLmfVKzk9rAyiNb91ft","profiles":["UCFmhjWPGw--zFyDLBYxnnqA"],"sources":["https://www.youtube.com/channel/UCFmhjWPGw--zFyDLBYxnnqA/about","https://open.spotify.com/artist/0CrGLmfVKzk9rAyiNb91ft"]},
 {"name":"Cleber & Cauan","aliases":["Cleber & Cauan"],"artistId":"6Y8pfJkEdw4EAST4g9C026","profiles":["UCQ4-d9YtUs2LNWOJt0d0Kbg"],"sources":["https://www.youtube.com/channel/UCQ4-d9YtUs2LNWOJt0d0Kbg/about","https://open.spotify.com/artist/6Y8pfJkEdw4EAST4g9C026"]},
 {"name":"Mari Fernandez","aliases":["Mari Fernandez"],"artistId":"0BHm7qbh3ENxvXzkQAG7MP","profiles":["UC4GQcpSxXmvhjn8bAfUubgg"],"sources":["https://www.youtube.com/channel/UC4GQcpSxXmvhjn8bAfUubgg/about","https://open.spotify.com/artist/0BHm7qbh3ENxvXzkQAG7MP"]},
 {"name":"By Melody Remix","aliases":["By Melody Remix"],"artistId":"4Pm9h6OTzzt7hNFJ8tpc3x","profiles":["UCbFvlkHCyoVxEO3d9QzdU8Q"],"sources":["https://www.youtube.com/channel/UCbFvlkHCyoVxEO3d9QzdU8Q/about","https://open.spotify.com/artist/4Pm9h6OTzzt7hNFJ8tpc3x"]},
 {"name":"Insanou","aliases":["Insanou"],"artistId":"44zmnvHV1E3qfpJzzjcLR3","profiles":["UC81qZMkuX_kaJytab4wKqng"],"sources":["https://www.youtube.com/channel/UC81qZMkuX_kaJytab4wKqng/about","https://open.spotify.com/artist/44zmnvHV1E3qfpJzzjcLR3"]},
 {"name":"Natanzinho Lima","aliases":["Natanzinho Lima"],"artistId":"0Il5vC8lqunSFNav4mMLxU","profiles":["UCIy12y9x1XhfFhqqfACsVeg"],"sources":["https://www.youtube.com/channel/UCIy12y9x1XhfFhqqfACsVeg/about","https://open.spotify.com/artist/0Il5vC8lqunSFNav4mMLxU"]},
 {"name":"Matheus Fernandes","aliases":["Matheus Fernandes"],"artistId":"37mqXU98U5GmH5ZDtlHM1c","profiles":["UCcyCMFgcMxg29w97wXqYAXA"],"sources":["https://www.youtube.com/channel/UCcyCMFgcMxg29w97wXqYAXA/about","https://open.spotify.com/artist/37mqXU98U5GmH5ZDtlHM1c"]},
 {"name":"Felipe Araújo","aliases":["Felipe Araújo"],"artistId":"47uyFQHOD02S0lj9ptRpoB","profiles":["UCc6QyDjq9eXr4hzx_6ucY0Q"],"sources":["https://www.youtube.com/channel/UCc6QyDjq9eXr4hzx_6ucY0Q/about","https://open.spotify.com/artist/47uyFQHOD02S0lj9ptRpoB"]},
 {"name":"Felipe e Falcão","aliases":["Felipe e Falcão"],"artistId":"1Jln3OBAJtmL9kmyGvSZJJ","profiles":["UCBNMRdilXpgAtf_Hcb2J6Kg"],"sources":["https://www.youtube.com/channel/UCBNMRdilXpgAtf_Hcb2J6Kg/about","https://open.spotify.com/artist/1Jln3OBAJtmL9kmyGvSZJJ"]},
 {"name":"Guilherme & Santiago","aliases":["Guilherme e Santiago","Guilherme & Santiago"],"artistId":"61rqgwKmF0QwycnC8O82rn","profiles":["UC-QoZ0V193UMCLFaK-usjqw"],"sources":["https://www.youtube.com/channel/UC-QoZ0V193UMCLFaK-usjqw/about","https://open.spotify.com/artist/61rqgwKmF0QwycnC8O82rn"]},
 {"name":"Marcos & Belutti","aliases":["Marcos e Belutti","Marcos & Belutti"],"artistId":"0NsJZ5PMjqghGDuMzY7CuT","profiles":["UC605s7hMHDSDaUx3txHckGQ"],"sources":["https://www.youtube.com/channel/UC605s7hMHDSDaUx3txHckGQ/about","https://open.spotify.com/artist/0NsJZ5PMjqghGDuMzY7CuT"]},
 {"name":"Bruno Rosa","aliases":["Bruno Rosa"],"artistId":"0SPHfj49UeOgHKwSYcn8xZ","profiles":["UCgENMvw0UY0ba0QQRsSQhrw"],"sources":["https://www.youtube.com/channel/UCgENMvw0UY0ba0QQRsSQhrw/about","https://open.spotify.com/artist/0SPHfj49UeOgHKwSYcn8xZ"]},
 {"name":"Leo Chaves","aliases":["Leo Chaves"],"artistId":"0FYpZOHSyfPpCSsLwydVbL","profiles":["UCLc0buO0074-gShmYg-LiUA"],"sources":["https://www.youtube.com/channel/UCLc0buO0074-gShmYg-LiUA/about","https://open.spotify.com/artist/0FYpZOHSyfPpCSsLwydVbL"]},
 {"name":"CountryBeat","aliases":["CountryBeat"],"artistId":"5IREutgMnyQqRcc8r15gWk","profiles":["UCJlw9bI6UlAiNOOiddnx3OQ"],"sources":["https://www.youtube.com/channel/UCJlw9bI6UlAiNOOiddnx3OQ/about","https://open.spotify.com/artist/5IREutgMnyQqRcc8r15gWk"]}
];
const SPOTIFY_QUEUE_EXCLUSIONS=[
 ['JV Music','Canal de divulgação de músicas e apresentações de diferentes artistas; não é uma identidade artística única.','https://www.youtube.com/channel/UCDkZAPG0urTAE7p6UChevOg'],
 ['Canal JV Music','Canal de divulgação de apresentações e playlists de diversos artistas de forró.','https://www.youtube.com/channel/UCtuGSMqrYY6kvq2CWvJ3FbA'],
 ['Música Popular Brasileira','Canal de playlists com canções de vários artistas de MPB; não é um artista musical.','https://www.youtube.com/channel/UCf3bDZ_5QJvFRwsUnfKMVOg'],
 ['CANAL BSP','Canal de apresentações e repertório de vários artistas de samba e pagode.','https://www.youtube.com/channel/UCIMjLtkDl4JAPaLGzsrkkdA'],
 ['Fruto Milionário','Canal de documentários e curiosidades; não é artista musical.','https://www.youtube.com/channel/UC11XjvFpiqfpTHzI8hVAmVg'],
 ['PopInsiderBR','Canal editorial sobre rock e pop; não é o artista apresentado.','https://www.youtube.com/channel/UC1X9Vpub7UZ3gbchMTOJF9g'],
 ['Filtr Music Brasil','Marca editorial de playlists e performances de outros artistas.','https://www.youtube.com/channel/UC4sFJvWwapBhZXUWPmgorBw'],
 ['Som Livre','Gravadora; seus artistas são entidades separadas.','https://www.youtube.com/channel/UCEATCATai_oafDuqKssZITw'],
 ['TV Globo','Emissora de televisão.','https://www.youtube.com/channel/UCEPRQVF6hxGGM9gi1ELaWHg'],
 ['The Noite com Danilo Gentili','Programa de entrevistas e humor.','https://www.youtube.com/channel/UCEWOoncsrmirqnFqxer9lmA'],
 ['Central Gospel Music','Gravadora; não confundir com seus artistas.','https://www.youtube.com/channel/UCGPgnwpRi4axU_Y3g36za8g'],
 ['Rede Guia Ponto Novo | MKT','Canal de notícias e marketing.','https://www.youtube.com/channel/UCRjzqNqDu-a-1f3QG5-QzNA'],
 ['TV Brasil','Emissora pública.','https://www.youtube.com/channel/UCSv9d0kQegylHWpP83jWSQg'],
 ['Rádio CBN','Emissora jornalística.','https://www.youtube.com/channel/UCbiGwU0-W1XCDUrt3BTVrag'],
 ['Netflix Brasil','Empresa de entretenimento e divulgação de programas.','https://www.youtube.com/channel/UCc1l5mTmAv2GC_PXrBpqyKQ'],
 ['VID STATUS GOSPEL','Canal de publicação de trechos e status; sem identidade artística própria confirmada.','https://www.youtube.com/channel/UCcmZxCBhaweNHn2feCx-_-Q'],
 ['HeyTails','Criador de conteúdo sobre games e vida no Japão; sem projeto musical oficial indicado.','https://linktr.ee/heytails'],
 ['Ediel Costa','Criador de conteúdo e consultor de negócios digitais; sem projeto musical oficial indicado.','https://edielcosta.com/'],
 ['MoriMura','Criador de vídeos; aguarda indicação de projeto musical próprio para entrar nesta fila.','https://www.youtube.com/channel/UCdK_G8bo0X0kVwxiWoIUfwQ'],
 ['Todah Experience Live','Programa de produção e divulgação de outros artistas.','https://todah.com.br/blog/13a-edicao-e-gravada-em-agosto-e-marca-o-ultimo-live-do-ano-de-2026'],
 ['PAGODE DA FEIRA - RJ','Canal de evento e apresentações de diferentes grupos; não confundir com os convidados.','https://www.youtube.com/watch?v=Cl7CFFY5j-0']
].map(([name,reason,source])=>({name,reason,source}));
function spotifyReviewedIdentity(name,profileUrl){
 const key=spotifyPublicName(spotifyPublicQueueName(name)),scoped=arguments.length>1,rule=SPOTIFY_REVIEWED_LINKS.find(r=>r.aliases.some(n=>spotifyPublicName(spotifyPublicQueueName(n))===key)&&(!scoped||r.profiles.some(id=>profileUrl==='https://www.youtube.com/channel/'+id)));
 if(!rule)return null;
 return {artistId:rule.artistId,names:[rule.name,...rule.aliases],sourceUrl:rule.sources[0],sources:rule.sources,reviewed:true};
}
function spotifyQueueExclusion(name){const key=spotifyPublicName(spotifyPublicQueueName(name));return SPOTIFY_QUEUE_EXCLUSIONS.find(r=>spotifyPublicName(spotifyPublicQueueName(r.name))===key)||null;}
function spotifyRegistryIdentity(profile,name){
 if(!/^https:\/\/www\.youtube\.com\/channel\/UC[\w-]{22}$/.test(profile.url||''))return null;
 const ids=[...new Set([...String(profile.description||'').matchAll(/https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?artist\/([A-Za-z0-9]{22})(?:[/?\s]|$)/g)].map(m=>m[1]))];
 return ids.length===1?{artistId:ids[0],names:[name],sourceUrl:profile.url,sources:[profile.url],registryLink:true}:null;
}
// Only read the registered channel's own metadata, never video cards or recommendations.
function spotifyYoutubeMetadata(html,profileUrl){
 const channel=String(profileUrl||'').match(/^https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})$/)?.[1];
 if(!channel)return null;
 const raw=html.match(/\bytInitialData\s*=\s*(\{.*?\})\s*;\s*<\/script>/s)?.[1];
 let meta;try{meta=JSON.parse(raw||'{}').metadata?.channelMetadataRenderer;}catch{return null;}
 return meta?.externalId===channel?meta:null;
}
function spotifyYoutubeIdentity(html,profileUrl,name){
 const meta=spotifyYoutubeMetadata(html,profileUrl);if(!meta)return null;
 const links=[];
 for(const tag of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const data=JSON.parse(tag[1]);if(data['@type']==='ProfilePage'||data['@type']==='Person'||data['@type']==='Organization'){const profile=data.mainEntity||data;if(Array.isArray(profile.sameAs))links.push(...profile.sameAs);}}catch{}
 }
 return spotifyRegistryIdentity({url:profileUrl,description:[meta.description,...links].join('\n')},name);
}
