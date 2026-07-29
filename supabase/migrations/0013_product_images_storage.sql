-- MesaFlow — Upload de Imagens dos Produtos (Sprint "Upload de Imagens dos
-- Produtos", 2026-07-28)
--
-- Antes desta migration, `menu_items.image_url` (já existe desde 0001) só
-- era preenchido colando uma URL de imagem já hospedada em outro lugar.
-- Esta migration não muda a coluna — só cria o bucket de Storage e as
-- políticas para que o próprio painel possa fazer o upload e gerar essa
-- URL sozinho.
--
-- Bucket público (`public = true`): o Cardápio Público precisa exibir a
-- imagem para clientes anônimos, sem sessão — leitura pública é inerente a
-- esse requisito, não uma escolha de conveniência. Isso NÃO abre a escrita:
-- insert/update/delete continuam restritos por RLS abaixo, então um
-- restaurante só consegue gravar/apagar dentro da própria pasta
-- (`{restaurant_id}/products/...`), mesmo o bucket sendo de leitura
-- pública. Sem política de `select` própria: um bucket público já serve o
-- arquivo direto pela URL pública, sem passar pelo RLS de `storage.objects`.
--
-- Isolamento multi-tenant segue exatamente o mesmo padrão já usado em
-- `0005_menu_write_policies.sql` para `menu_categories`/`menu_items`:
-- comparar o primeiro segmento do caminho do arquivo
-- (`storage.foldername(name)[1]`, que é o `{restaurant_id}` do path) contra
-- o `restaurant_id` do usuário autenticado via `profiles`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-media',
  'restaurant-media',
  true,
  5242880, -- 5 MB — mesmo limite validado no cliente (contrato desta sprint)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "insert_own_product_images" on storage.objects
  for insert
  with check (
    bucket_id = 'restaurant-media'
    and (storage.foldername(name))[1] in (select restaurant_id::text from public.profiles where id = auth.uid())
  );

create policy "update_own_product_images" on storage.objects
  for update
  using (
    bucket_id = 'restaurant-media'
    and (storage.foldername(name))[1] in (select restaurant_id::text from public.profiles where id = auth.uid())
  )
  with check (
    bucket_id = 'restaurant-media'
    and (storage.foldername(name))[1] in (select restaurant_id::text from public.profiles where id = auth.uid())
  );

create policy "delete_own_product_images" on storage.objects
  for delete
  using (
    bucket_id = 'restaurant-media'
    and (storage.foldername(name))[1] in (select restaurant_id::text from public.profiles where id = auth.uid())
  );
