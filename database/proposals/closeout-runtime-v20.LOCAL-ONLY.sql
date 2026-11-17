-- LOCAL CLOSED V20 PROPOSAL. Supersedes UNAPPLIED V18/V19 proposals;
-- not for incremental application over already-installed terminal objects.
-- No bootstrap clearance, grants or activation.
begin;
-- Exact CURRENT staging source/security capture. No automatic repinning.
do $$begin if current_setting('standard_conforming_strings')<>'on'then raise exception 'terminal_string_mode_mismatch';end if;end$$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.native_optional_finance_service_access_v2(uuid,uuid,uuid)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='26543e3fba3c063e3431ae9c5028faec0103fb2f431d55631b0cd42dbd2a9ccd')then raise exception 'terminal_mature_catalog_mismatch: app.native_optional_finance_service_access_v2(uuid,uuid,uuid)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='ee85088b4dd76be7f25ddd372fd1472cd39029dad87e5db6938a11b17da152ff')then raise exception 'terminal_mature_catalog_mismatch: app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b74c3b41a2cff74599cf339ca1d0f05353f744c668b906529e7882a715c17dec')then raise exception 'terminal_mature_catalog_mismatch: app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b54cb0b9ce8e672ce1ceee5644879120514ca0bb4c3cf8d9829ef6f2cd817a82')then raise exception 'terminal_mature_catalog_mismatch: app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='0d7aed515cd10a1ba8b45390cf015aaebb1f12a45eaa74ed81067436b4703458')then raise exception 'terminal_mature_catalog_mismatch: app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='fea750fb09df6300053b9575633b284a24ef2e57abc9def9a365416f20a85f70')then raise exception 'terminal_mature_catalog_mismatch: app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='816efa66a1123d53036f5882ac81ea68f8e3adf501f65cf255c92a657a13b35a')then raise exception 'terminal_mature_catalog_mismatch: app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='e56cba4e77197594b326e712a4a9f3495d6f5721e21fcc72106047e91cf5c942')then raise exception 'terminal_mature_catalog_mismatch: app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='623f6f4a473dc2e2bc494e435c7c0cad69e0e8c8637b9dbe3e98d8ac3dedf555')then raise exception 'terminal_mature_catalog_mismatch: app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='c7eb4ed1bdbff318611866d728e3cff751372594a49c5da3846f127e72eb3bff')then raise exception 'terminal_mature_catalog_mismatch: app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b9724794bd9a80556c6a6dba35b1716528b2b3ee25c41103ecda150c5f74a609')then raise exception 'terminal_mature_catalog_mismatch: app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='dde55f6c984b65239c5bdb7a9149489b2d122529d4145fc2e6928c722e64228b')then raise exception 'terminal_mature_catalog_mismatch: app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='226cd1ee666ca4326a6874c7be5259f63947376ce704f6c2214e29a8ffd04fba')then raise exception 'terminal_mature_catalog_mismatch: app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='ef2a843d5e7dcc6e2ff541078b33912b1dc8b86ffc63491105d0e582cea8020b')then raise exception 'terminal_mature_catalog_mismatch: app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='c11e54f960473c06f6e4f19569233378d0564f45dd07345a57264c8a952e891a')then raise exception 'terminal_mature_catalog_mismatch: app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='843fcd09c0006f3e33f543bb2c1c1126632f6027e22886530010db8d51a76b9e')then raise exception 'terminal_mature_catalog_mismatch: app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b9c954eda67883209a0be6291a5bd636aff552b3057a37022af39da816eec97b')then raise exception 'terminal_mature_catalog_mismatch: app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres","service_role=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='3de6386b7fb12429fffc86fbed3d507828b218193201be5304573454a82731d9')then raise exception 'terminal_mature_catalog_mismatch: public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres","service_role=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='23b7daa2ac39d7f8e468bed2ae1959d4aaa86188a40e483294f2ce7a26422588')then raise exception 'terminal_mature_catalog_mismatch: public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_manual_pool_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='2215235ed561e05cc04f5744422e653177dc6a35d4b2c9fc7b9b96af7f3f79ec')then raise exception 'terminal_mature_catalog_mismatch: public.get_manual_pool_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_modern_event_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='33c2e2c5f77ddde53b1854d0faf456e65a633246c6dbb56aa35ca91a1a1a3a0c')then raise exception 'terminal_mature_catalog_mismatch: public.get_modern_event_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_modern_event_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='8b2c1a309db3547cd67efeeee720ee8187abf90ade8cf75ba528711456d2034f')then raise exception 'terminal_mature_catalog_mismatch: public.get_modern_event_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_regular_consolation_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='2dc79f419f168e980ad25ccfb4098f744d2ee8ca39d878baa9b1ffeae93f7b5e')then raise exception 'terminal_mature_catalog_mismatch: public.get_regular_consolation_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.get_regular_consolation_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='ad85240b8f677abe5b56d6c6eb52379fe8212a3819f6ee4d5f642e17166f3120')then raise exception 'terminal_mature_catalog_mismatch: public.get_regular_consolation_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='1ffe7feea77eaec86969b033841e80c53522793224b8e322cdc4d90661ddc304')then raise exception 'terminal_mature_catalog_mismatch: public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='a78aa0f7995c107348b9bfc7fd9c078ac4866adc3386edd6894d53350febbfa0')then raise exception 'terminal_mature_catalog_mismatch: public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='61de5de85d0faa9deb51332dc2d058de9fd00cbbb35a2237cd9be1f465287616')then raise exception 'terminal_mature_catalog_mismatch: public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='c4f356c583a76d9a881c1dd60f20e5ae0f4489a01fd58733263a309d99e6a768')then raise exception 'terminal_mature_catalog_mismatch: public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if to_regprocedure('public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)')is not null then raise exception 'terminal_expected_absent_delegate_changed';end if;end $pin$;
do $pin$begin if to_regprocedure('public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)')is not null then raise exception 'terminal_expected_absent_delegate_changed';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b4e86ef746602679072975827cc4a71f8454cdd2bba84620d0ba0fd438dcade8')then raise exception 'terminal_mature_catalog_mismatch: public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='96d1bfaa18d0bf448288f3ee77d4353a4d13839b62a5a49f1dd2a798455724ce')then raise exception 'terminal_mature_catalog_mismatch: public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='ef44a346b00cdd239876bd8266081abfd25ee4bf93e8e8ccc0c463cd92b5114e')then raise exception 'terminal_mature_catalog_mismatch: public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='f4296e6904a8b71ee56f0d5f8cbdcbf2199cfcf4deab909a18edaffc4b2698be')then raise exception 'terminal_mature_catalog_mismatch: public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres","service_role=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='78ea461c175698e888c1b3fad14ecea03feb89cceff082a02671e9218a3bd60f')then raise exception 'terminal_mature_catalog_mismatch: public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='8371a1234da7f7d09e472b2909a94505d3953890f8f0ab9bcbcbe1ab65d686e5')then raise exception 'terminal_mature_catalog_mismatch: app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.review_native_recorded_fund_v1(uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='f296c953f6f24b3cc2bf3e45f211792697fdfb2b84df2028f21b5608be12f543')then raise exception 'terminal_mature_catalog_mismatch: app.review_native_recorded_fund_v1(uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\"","TimeZone=UTC"]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='64f5f3daf47c1ced5d16f10de1d2120a8c67c324e89b3370fe1c87fa24d734a3')then raise exception 'terminal_mature_catalog_mismatch: app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)';end if;end $pin$;
do $pin$begin if not exists(select 1 from pg_proc p where p.oid=to_regprocedure('app.reject_immutable_history()') and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and to_jsonb(p.proacl)is not distinct from '["postgres=X/postgres"]'::jsonb and to_jsonb(p.proconfig)is not distinct from '["search_path=\"\""]'::jsonb and encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='4a8b10e0911c6cb6e4196c49f289ac0c9b2ba423de7de5deae629844694273cc')then raise exception 'terminal_mature_catalog_mismatch: app.reject_immutable_history()';end if;end $pin$;
do $relations$declare actual jsonb;begin actual:=jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('signature',v.signature,'found',p.oid is not null,'owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'bodyHash',encode(extensions.digest(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex'),'definition',case when p.oid is not null then pg_get_functiondef(p.oid)end)order by v.signature)from(values('app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)'),('app.review_native_recorded_fund_v1(uuid,uuid,jsonb)'),('app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)'))v(signature)left join pg_proc p on p.oid=to_regprocedure(v.signature)),'relations',(select jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull)order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'constraints',(select jsonb_agg(jsonb_build_array(k.conname,pg_get_constraintdef(k.oid,true),k.condeferrable,k.condeferred)order by k.conname)from pg_constraint k where k.conrelid=c.oid),'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid,true),t.tgenabled)order by t.tgname)from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal))order by c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='app'and c.relname in('native_playoff_finance_write_operations_v1','native_playoff_finance_write_outcomes_v1','selected_step_pool_ownership_operations_v3')));if actual is distinct from '{"functions":[{"acl":["postgres=X/postgres"],"found":true,"owner":"postgres","config":["search_path=\"\""],"bodyHash":"8371a1234da7f7d09e472b2909a94505d3953890f8f0ab9bcbcbe1ab65d686e5","signature":"app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)","definition":"CREATE OR REPLACE FUNCTION app.finish_native_playoff_finance_write_v1(actor uuid, tid uuid, eid uuid, op uuid, result_value jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO ''''\nAS $function$\ndeclare operation app.native_playoff_finance_write_operations_v1%rowtype;result jsonb;begin\n select*into strict operation from app.native_playoff_finance_write_operations_v1\n  where actor_id=actor and operation_id=op and tournament_id=tid and event_id=eid;\n if result_value->>''status''not in(''accepted'',''rejected'')then raise exception''invalid_native_playoff_finance_outcome'';end if;\n result:=result_value||jsonb_build_object(\n  ''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,\n  ''request'',operation.request_payload,''fullRequestHash'',operation.request_hash,\n  ''historicalReceipt'',false,''currentSourceVerified'',result_value->>''status''=''accepted'',\n  ''moneyMoved'',false,''payoutAuthorized'',false,''disbursementAuthorized'',false,\n  ''finalizationAuthorized'',false\n );\n insert into app.native_playoff_finance_write_outcomes_v1(\n  actor_id,operation_id,tournament_id,event_id,result\n )values(actor,op,tid,eid,result);\n return result;\nend$function$\n","securityDefiner":true},{"acl":["postgres=X/postgres"],"found":true,"owner":"postgres","config":["search_path=\"\""],"bodyHash":"f296c953f6f24b3cc2bf3e45f211792697fdfb2b84df2028f21b5608be12f543","signature":"app.review_native_recorded_fund_v1(uuid,uuid,jsonb)","definition":"CREATE OR REPLACE FUNCTION app.review_native_recorded_fund_v1(tid uuid, eid uuid, request_value jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO ''''\nAS $function$\ndeclare a uuid:=auth.uid();op uuid;expected integer;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;\n prior_result jsonb;recipient jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;\n prior_review app.native_recorded_fund_reviews_v1%rowtype;record_row app.native_unrestricted_income_records_v1%rowtype;\n income_records jsonb:=''[]'';income_lines jsonb:=''[]'';income_latest jsonb:=''{}'';income_item jsonb;line_item jsonb;\n income_digest text;income_head integer:=0;active_income numeric:=0;\n review_id uuid;review_version integer;review_status text;reason_value text;source_capture jsonb;source_digest text;response jsonb;i integer;\n sanctioning_expense uuid;sanctioning jsonb;\nbegin\n if a is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;\n if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;\n if jsonb_typeof(request_value)is distinct from''object''or(select count(*)from jsonb_object_keys(request_value))<>10\n  or not(request_value?&array[''kind'',''operationId'',''expectedVersion'',''proposalRevisionId'',''nativeAllocationRevisionId'',''incomeHeadVersion'',''incomeHeadDigest'',''status'',''sanctioningExpenseEventId'',''reason''])\n  or request_value->>''kind''is distinct from''native-recorded-fund-review-v1''\n  or coalesce(request_value->>''operationId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''\n  or coalesce(request_value->>''proposalRevisionId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''\n  or coalesce(request_value->>''nativeAllocationRevisionId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''\n  or jsonb_typeof(request_value->''expectedVersion'')is distinct from''number''or(request_value->>''expectedVersion'')!~''^(0|[1-9][0-9]*)$''\n  or(request_value->>''expectedVersion'')::numeric>2147483646\n  or jsonb_typeof(request_value->''incomeHeadVersion'')is distinct from''number''or(request_value->>''incomeHeadVersion'')!~''^(0|[1-9][0-9]*)$''\n  or(request_value->>''incomeHeadVersion'')::numeric>2147483647\n  or coalesce(request_value->>''incomeHeadDigest'','''')!~''^[a-f0-9]{64}$''\n  or jsonb_typeof(request_value->''status'')is distinct from''string''\n  or request_value->>''status''not in(''reviewed_zero'',''recorded_complete'')\n  or(request_value->''sanctioningExpenseEventId''is distinct from''null''::jsonb\n   and(jsonb_typeof(request_value->''sanctioningExpenseEventId'')is distinct from''string''\n    or coalesce(request_value->>''sanctioningExpenseEventId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''))\n  or jsonb_typeof(request_value->''reason'')is distinct from''string''\n  or request_value->>''reason''<>app.custom_payout_classification_text_v2(request_value->>''reason'')\n  or app.event_settings_js_text_length_v3(request_value->>''reason'')not between 1 and 2000 then\n  return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;\n op:=(request_value->>''operationId'')::uuid;expected:=(request_value->>''expectedVersion'')::integer;\n sanctioning_expense:=case when request_value->''sanctioningExpenseEventId''=''null''::jsonb then null\n  else(request_value->>''sanctioningExpenseEventId'')::uuid end;\n review_status:=request_value->>''status'';reason_value:=request_value->>''reason'';\n if not pg_try_advisory_xact_lock(hashtextextended(a::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;\n if not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;\n perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;\n perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in(''director'',''co_director'')order by role for key share nowait;\n if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;\n request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(''native-playoff-finance-write-v1'',a,tid,eid,op,request_value)::text,''utf8''),''sha256''),''hex'');\n select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;\n if found then\n  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;\n  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;\n  if prior_result is null then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete'');end if;\n  return prior_result||jsonb_build_object(''historicalReceipt'',true,''currentSourceVerified'',false);\n end if;\n if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;\n if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''final_awards_already_recorded'');end if;\n recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);\n if recipient->>''status''=''retry_exact''then return recipient;end if;\n if recipient->>''status''<>''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(recipient->>''code'',''source_unavailable''));end if;\n select*into proposal from app.operational_event_finance_revisions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;\n if not found or proposal.id::text is distinct from request_value->>''proposalRevisionId''\n  or proposal.id::text is distinct from recipient#>>''{proposal,revisionId}''\n  or request_value->>''nativeAllocationRevisionId''is distinct from recipient#>>''{nativeFinanceSource,raw,allocation,revisionId}''then\n  return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;\n sanctioning:=app.native_sanctioning_coverage_v1(tid,eid,recipient,sanctioning_expense);\n if sanctioning->>''status''=''retry_exact''then return sanctioning;end if;\n if sanctioning->>''status''<>''available''then\n  return jsonb_build_object(''status'',''rejected'',''code'',coalesce(sanctioning->>''code'',''sanctioning_coverage_unverified''));end if;\n for i in jsonb_array_length(proposal.editor#>''{basis,history}'')..jsonb_array_length(proposal.editor->''history'')-1 loop\n  line_item:=proposal.editor->''history''->i;\n  if line_item#>>''{line,category}''is distinct from''unrestricted_income''then return jsonb_build_object(''status'',''rejected'',''code'',''unrecorded_finance_edit'');end if;\n  income_lines:=income_lines||jsonb_build_array(line_item);\n end loop;\n select coalesce(max(version),0)into income_head from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid;\n if income_head<>jsonb_array_length(income_lines)then return jsonb_build_object(''status'',''rejected'',''code'',''income_history_incomplete'');end if;\n for record_row in select*from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid order by version loop\n  line_item:=income_lines->(record_row.version-1);\n  if line_item#>>''{line,lineId}''is distinct from record_row.income_id::text\n   or line_item#>>''{line,recordId}''is distinct from record_row.record_id::text\n   or line_item#>''{line,priorRecordId}''is distinct from coalesce(to_jsonb(record_row.prior_record_id),''null''::jsonb)\n   or(line_item#>>''{line,amountMinor}'')::numeric is distinct from record_row.amount_minor::numeric\n   or(line_item#>>''{line,voided}'')::boolean is distinct from record_row.voided\n   or line_item->>''label''is distinct from record_row.label or line_item#>>''{line,reason}''is distinct from record_row.reason then\n   return jsonb_build_object(''status'',''rejected'',''code'',''income_history_changed'');end if;\n  income_records:=income_records||jsonb_build_array(jsonb_build_object(''incomeId'',record_row.income_id,''recordId'',record_row.record_id,\n   ''priorRecordId'',record_row.prior_record_id,''physicalEvidenceId'',record_row.physical_evidence_id,''amountMinor'',record_row.amount_minor,\n   ''voided'',record_row.voided,''label'',record_row.label,''evidenceReference'',record_row.evidence_reference,''reason'',record_row.reason,\n   ''recordedBy'',record_row.recorded_by,''recordedAt'',record_row.recorded_at));\n  income_latest:=jsonb_set(income_latest,array[record_row.income_id::text],jsonb_build_object(\n   ''voided'',record_row.voided,''amountMinor'',record_row.amount_minor),true);\n end loop;\n for income_item in select value from jsonb_each(income_latest)loop\n  if not(income_item->>''voided'')::boolean then active_income:=active_income+(income_item->>''amountMinor'')::numeric;end if;\n end loop;\n lock table app.roster_payment_events,app.tournament_expense_events in share mode nowait;\n if exists(select 1 from app.native_unrestricted_income_records_v1 ir\n   join app.roster_payment_events p on p.tournament_id=ir.tournament_id and p.id=ir.physical_evidence_id\n   where ir.tournament_id=tid)\n  or exists(select 1 from app.native_unrestricted_income_records_v1 ir\n   join app.tournament_expense_events x on x.tournament_id=ir.tournament_id and x.id=ir.physical_evidence_id\n   where ir.tournament_id=tid)then\n  return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');\n end if;\n income_digest:=encode(extensions.digest(convert_to(jsonb_build_array(''native-unrestricted-income-head-v1'',tid,eid,income_records)::text,''utf8''),''sha256''),''hex'');\n if(request_value->>''incomeHeadVersion'')::integer<>income_head or request_value->>''incomeHeadDigest''<>income_digest\n  or(review_status=''reviewed_zero''and active_income<>0)or(review_status=''recorded_complete''and active_income=0)then\n  return jsonb_build_object(''status'',''rejected'',''code'',''income_head_changed'');end if;\n select*into prior_review from app.native_recorded_fund_reviews_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;\n if coalesce(prior_review.version,0)<>expected then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;\n insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)\n  values(a,op,tid,eid,request_value,request_hash);\n source_capture:=jsonb_build_object(''recipientSourceDigest'',recipient->>''sourceDigest'',''proposalRevisionId'',proposal.id,\n  ''nativeAllocationRevisionId'',(request_value->>''nativeAllocationRevisionId'')::uuid,''incomeHeadVersion'',income_head,\n   ''incomeHeadDigest'',income_digest,''incomeRecords'',income_records,''reviewStatus'',review_status,\n   ''sanctioning'',sanctioning-''status'',''reviewReason'',reason_value);\n source_digest:=encode(extensions.digest(convert_to(jsonb_build_array(''native-recorded-fund-review-v1'',source_capture)::text,''utf8''),''sha256''),''hex'');\n  insert into app.native_recorded_fund_reviews_v1(tournament_id,event_id,version,prior_review_id,proposal_revision_id,\n   native_allocation_revision_id,sanctioning_fee_snapshot_id,sanctioning_expense_event_id,sanctioning_allocated_minor,\n   income_head_version,income_head_digest,review_status,source_capture,source_digest,reason,\n  reviewed_by,actor_id,operation_id)\n  values(tid,eid,expected+1,prior_review.id,proposal.id,(request_value->>''nativeAllocationRevisionId'')::uuid,\n   (sanctioning->>''snapshotId'')::uuid,sanctioning_expense,(sanctioning->>''allocatedExpenseMinor'')::bigint,income_head,income_digest,\n  review_status,source_capture,source_digest,reason_value,a,a,op)returning id,version into review_id,review_version;\n response:=jsonb_build_object(''status'',''accepted'',''code'',''native_recorded_fund_reviewed_v1'',''reviewId'',review_id,\n  ''version'',review_version,''reviewStatus'',review_status,''sourceDigest'',source_digest,''recordedFundAvailable'',true,\n  ''bankReceiptVerified'',false,''reviewedBy'',a,''reviewedAt'',(select reviewed_at from app.native_recorded_fund_reviews_v1 where id=review_id));\n return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);\nexception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');\n when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');\nend$function$\n","securityDefiner":true},{"acl":["postgres=X/postgres"],"found":true,"owner":"postgres","config":["search_path=\"\"","TimeZone=UTC"],"bodyHash":"64f5f3daf47c1ced5d16f10de1d2120a8c67c324e89b3370fe1c87fa24d734a3","signature":"app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)","definition":"CREATE OR REPLACE FUNCTION app.save_selected_step_pool_ownership_v3(actor uuid, tid uuid, eid uuid, op uuid, request jsonb)\n RETURNS jsonb\n LANGUAGE plpgsql\n SECURITY DEFINER\n SET search_path TO ''''\n SET \"TimeZone\" TO ''UTC''\nAS $function$\r\ndeclare source_value jsonb;head app.selected_step_pool_ownership_revisions_v3%rowtype;cost jsonb;cost_ids text[]:=''{}'';cost_total numeric:=0;\r\n prior app.selected_step_pool_ownership_operations_v3%rowtype;h text;rid uuid:=extensions.gen_random_uuid();result jsonb;\r\nbegin\r\n if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return null;end if;\r\n if coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''),(nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb)->>''role'','''')<>''service_role''or actor is null or op is null then return null;end if;\r\n if app.selected_step_pool_ownership_enabled_v3()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;\r\n if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;\r\n if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;\r\n perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;\r\n perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director''for update nowait;if not found then return null;end if;\r\n if jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>6\r\n  or not(request?&array[''expectedVersion'',''sourceDigest'',''reason'',''reviewed'',''kind'',''costClassifications''])or request->>''kind''is distinct from''selected-step-pool-ownership-v3''\r\n  or request->''reviewed''is distinct from''true''::jsonb or jsonb_typeof(request->''expectedVersion'')is distinct from''number''\r\n  or jsonb_typeof(request->''sourceDigest'')is distinct from''string''or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$''\r\n  or(request->>''expectedVersion'')::numeric>=2147483647 or coalesce(request->>''sourceDigest'','''')!~''^[a-f0-9]{64}$''\r\n  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')\r\n  or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000\r\n then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;\r\n h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-pool-ownership-v3'',actor,op,tid,eid,request)::text,''utf8''),''sha256''),''hex'');\r\n select*into prior from app.selected_step_pool_ownership_operations_v3 where actor_id=actor and operation_id=op;\r\n if found then\r\n  if prior.request_hash is distinct from h then return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;\r\n  select o.result into result from app.selected_step_pool_ownership_outcomes_v3 o where o.actor_id=actor and o.operation_id=op;\r\n  return coalesce(result,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));\r\n end if;\r\n if to_regclass(''app.selected_step_pool_finals_v3'')is null then return jsonb_build_object(''status'',''rejected'',''code'',''selected_pool_journal_required'');end if;\n if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''pool_awards_already_recorded'');end if;\n source_value:=app.selected_step_pool_ownership_source_v3(actor,tid,eid);\n if source_value->>''status''=''retry_exact''then return source_value;end if;\r\n if source_value is null or source_value->>''status''is distinct from''ownership_source_available''then return jsonb_build_object(''status'',''rejected'',''code'',''source_blocked'');end if;\r\n if source_value->>''sourceDigest''is distinct from request->>''sourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;\r\n if jsonb_typeof(request->''costClassifications'')is distinct from''array''\r\n  or jsonb_array_length(request->''costClassifications'')<>jsonb_array_length(source_value#>''{capture,basis,expenses}'')\r\n then return jsonb_build_object(''status'',''rejected'',''code'',''cost_coverage_incomplete'');end if;\r\n for cost in select value from jsonb_array_elements(request->''costClassifications'')loop\r\n  if jsonb_typeof(cost)is distinct from''object''or(select count(*)from jsonb_object_keys(cost))<>2\r\n   or not(cost?&array[''expenseEventId'',''category''])or coalesce(cost->>''category'','''')not in(''player_benefit'',''operating_expense'')\r\n   or coalesce(cost->>''expenseEventId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''\r\n   or cost->>''expenseEventId''=any(cost_ids)\r\n   or not exists(select 1 from jsonb_array_elements(source_value#>''{capture,basis,expenses}'')x where x->>''expenseEventId''=cost->>''expenseEventId'')\r\n  then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_cost_classification'');end if;\r\n  cost_ids:=array_append(cost_ids,cost->>''expenseEventId'');\r\n  cost_total:=cost_total+(select(x->>''amountMinor'')::numeric from jsonb_array_elements(source_value#>''{capture,basis,expenses}'')x where x->>''expenseEventId''=cost->>''expenseEventId'');\r\n end loop;\r\n if cost_total>(source_value#>>''{funds,regularReceiptsMinor}'')::numeric then return jsonb_build_object(''status'',''rejected'',''code'',''negative_regular_fund'');end if;\r\n select*into head from app.selected_step_pool_ownership_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;\r\n if coalesce(head.version,0)<>(request->>''expectedVersion'')::integer then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;\r\n insert into app.selected_step_pool_ownership_operations_v3(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);\r\n insert into app.selected_step_pool_ownership_revisions_v3(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,source_digest,source_capture,reason)\r\n values(rid,tid,eid,coalesce(head.version,0)+1,head.id,actor,op,source_value->>''sourceDigest'',source_value,request->>''reason'');\r\n result:=jsonb_build_object(''status'',''selected_step_pool_ownership_reviewed_v3'',''revisionId'',rid,''version'',coalesce(head.version,0)+1,\n  ''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''sourceDigest'',source_value->>''sourceDigest'',''moneyMoved'',false,''finalizationAuthorized'',false);\r\n insert into app.selected_step_pool_ownership_outcomes_v3(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result);\r\n insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)\n values(tid,actor,''selected_step_pool_ownership_v3'',rid,''ownership_reviewed'',result);\n return result;\r\nexception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');\r\nend$function$\n","securityDefiner":true}],"relations":[{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"name":"app.native_playoff_finance_write_operations_v1","force":true,"owner":"postgres","columns":[["actor_id","uuid",true],["operation_id","uuid",true],["tournament_id","uuid",true],["event_id","uuid",true],["request_payload","jsonb",true],["request_hash","text",true],["created_at","timestamp with time zone",true]],"triggers":[["native_playoff_finance_write_operations_v1_immutable","CREATE TRIGGER native_playoff_finance_write_operations_v1_immutable BEFORE DELETE OR UPDATE ON app.native_playoff_finance_write_operations_v1 FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_history()","O"]],"constraints":[["native_playoff_finance_write__actor_id_operation_id_tournam_key","UNIQUE (actor_id, operation_id, tournament_id, event_id)",false,false],["native_playoff_finance_write_operat_event_id_tournament_id_fkey","FOREIGN KEY (event_id, tournament_id) REFERENCES app.events(id, tournament_id)",false,false],["native_playoff_finance_write_operations_v1_actor_id_fkey","FOREIGN KEY (actor_id) REFERENCES app.profiles(id)",false,false],["native_playoff_finance_write_operations_v1_check","CHECK (request_hash = encode(digest(convert_to(jsonb_build_array(''native-playoff-finance-write-v1'', actor_id, tournament_id, event_id, operation_id, request_payload)::text, ''utf8''::name), ''sha256''::text), ''hex''::text))",false,false],["native_playoff_finance_write_operations_v1_pkey","PRIMARY KEY (actor_id, operation_id)",false,false],["native_playoff_finance_write_operations_v1_request_hash_check","CHECK (request_hash ~ ''^[a-f0-9]{64}$''::text)",false,false]]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"name":"app.native_playoff_finance_write_outcomes_v1","force":true,"owner":"postgres","columns":[["actor_id","uuid",true],["operation_id","uuid",true],["tournament_id","uuid",true],["event_id","uuid",true],["result","jsonb",true],["created_at","timestamp with time zone",true]],"triggers":[["native_playoff_finance_write_outcomes_v1_immutable","CREATE TRIGGER native_playoff_finance_write_outcomes_v1_immutable BEFORE DELETE OR UPDATE ON app.native_playoff_finance_write_outcomes_v1 FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_history()","O"]],"constraints":[["native_playoff_finance_write__actor_id_operation_id_tourna_fkey","FOREIGN KEY (actor_id, operation_id, tournament_id, event_id) REFERENCES app.native_playoff_finance_write_operations_v1(actor_id, operation_id, tournament_id, event_id)",false,false],["native_playoff_finance_write_outcomes_v1_pkey","PRIMARY KEY (actor_id, operation_id)",false,false]]},{"acl":["postgres=arwdDxtm/postgres"],"rls":true,"name":"app.selected_step_pool_ownership_operations_v3","force":true,"owner":"postgres","columns":[["actor_id","uuid",true],["operation_id","uuid",true],["tournament_id","uuid",true],["event_id","uuid",true],["request_payload","jsonb",true],["request_hash","text",true],["created_at","timestamp with time zone",true]],"triggers":[["selected_step_pool_ownership_operations_v3_immutable","CREATE TRIGGER selected_step_pool_ownership_operations_v3_immutable BEFORE DELETE OR UPDATE ON app.selected_step_pool_ownership_operations_v3 FOR EACH ROW EXECUTE FUNCTION app.reject_immutable_history()","O"]],"constraints":[["selected_step_pool_ownership__actor_id_operation_id_tournam_key","UNIQUE (actor_id, operation_id, tournament_id, event_id)",false,false],["selected_step_pool_ownership_operat_event_id_tournament_id_fkey","FOREIGN KEY (event_id, tournament_id) REFERENCES app.events(id, tournament_id)",false,false],["selected_step_pool_ownership_operations_v3_actor_id_fkey","FOREIGN KEY (actor_id) REFERENCES app.profiles(id)",false,false],["selected_step_pool_ownership_operations_v3_check","CHECK (request_hash = encode(digest(convert_to(jsonb_build_array(''selected-step-pool-ownership-v3'', actor_id, operation_id, tournament_id, event_id, request_payload)::text, ''utf8''::name), ''sha256''::text), ''hex''::text))",false,false],["selected_step_pool_ownership_operations_v3_pkey","PRIMARY KEY (actor_id, operation_id)",false,false],["selected_step_pool_ownership_operations_v3_request_hash_check","CHECK (request_hash ~ ''^[a-f0-9]{64}$''::text)",false,false]]}]}'::jsonb then raise exception 'terminal_exclusion_journal_metadata_mismatch';end if;end $relations$;

lock table app.manual_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.manual_pool_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.modern_event_closures_v1 in share row exclusive mode nowait;
lock table app.modern_event_final_operations_v1 in share row exclusive mode nowait;
lock table app.modern_prize_award_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_final_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_income_operations_v2 in share row exclusive mode nowait;
lock table app.native_playoff_finance_write_operations_v1 in share row exclusive mode nowait;
lock table app.native_unrestricted_income_sources_v1 in share row exclusive mode nowait;
lock table app.operation_receipts in share row exclusive mode nowait;
lock table app.regular_consolation_closures_v1 in share row exclusive mode nowait;
lock table app.regular_consolation_final_operations_v1 in share row exclusive mode nowait;
lock table app.selected_step_award_operations_v3 in share row exclusive mode nowait;
lock table app.selected_step_pool_operations_v3 in share row exclusive mode nowait;
-- CLOSED CURRENT V18 PROPOSAL. Supersedes UNAPPLIED V17; never run both.
-- NOT hosted install/activation clearance. Preserve all committed tombstones.

-- LOCAL DEVELOPMENT PROPOSAL ONLY. Not mature installation/ACL clearance.
-- Install with exact WRITER_GUARDS in ONE transaction; no public grants.
do $$begin if current_user<>'postgres'or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'terminal_installer_role_mismatch';end if;end$$;
create table app.closeout_terminal_retirements_v17(
 actor_id uuid not null,operation_id uuid not null,session_id uuid not null,
 tournament_id uuid not null,event_id uuid not null,stage text not null,
 request jsonb not null,result jsonb not null,reason text not null,
 database_actor text not null default current_user,database_session_actor text not null default session_user,
 created_at timestamptz not null default clock_timestamp(),primary key(actor_id,operation_id),
 check(stage in('pool','event','closure','regular','regular-closure')));
alter table app.closeout_terminal_retirements_v17 enable row level security;
alter table app.closeout_terminal_retirements_v17 force row level security;
revoke all on app.closeout_terminal_retirements_v17 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_terminal_retirements_v17 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_terminal_retirements_v17 for each statement execute function app.reject_immutable_history();
create function app.closeout_retirement_enabled_v17()returns boolean language sql stable set search_path=''as $$select false$$;
create function app.assert_closeout_operation_open_v17(actor uuid,op uuid)returns void language plpgsql security definer set search_path=''as $$begin
 if actor is null or op is null then raise exception 'terminal_operation_identity_required';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'terminal_isolation_unsupported';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('closeout-terminal-v17:'||actor||':'||op,0))then raise exception using errcode='55P03',message='terminal_operation_busy';end if;
 -- Enforcement is deliberately independent of the NEW retirement feature gate.
 if exists(select 1 from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op)then raise exception using errcode='PZ017',message='closeout_operation_retired';end if;
end$$;
create function app.retire_closeout_operation_v17(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb,reason text)returns jsonb language plpgsql security definer set search_path=''as $$
declare prior app.closeout_terminal_retirements_v17%rowtype;r jsonb;lookup text;journal text;present boolean;
begin
 if app.closeout_retirement_enabled_v17()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null or sid is null or tid is null or eid is null or op is null or stage is null or stage not in('pool','event','closure','regular','regular-closure')or jsonb_typeof(request)is distinct from'object'or octet_length(request::text)>150000 or reason is null or length(trim(reason))not between 1 and 1000 then raise exception 'invalid_terminal_request';end if;
 if request->>'kind'is distinct from(case stage when'pool'then'manual-pool-finalize-v1'when'event'then'modern-event-finalize-v1'when'closure'then'modern-event-close-v1'when'regular'then'regular-consolation-finalize-v1'else'regular-consolation-close-v1'end)then raise exception 'terminal_stage_request_mismatch';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'terminal_isolation_unsupported';end if;
 -- Session lock privilege must be independently established; no auth grants here.
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then raise exception 'terminal_session_denied';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('closeout-terminal-v17:'||actor||':'||op,0))then return jsonb_build_object('status','retry_exact','code','operation_busy');end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.stage=stage and prior.request=request and prior.reason=reason then return prior.result;end if;return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 lookup:=case stage when'pool'then'get_manual_pool_final_operation_v1'when'event'then'get_modern_event_final_operation_v1'when'closure'then'get_modern_event_closure_operation_v1'when'regular'then'get_regular_consolation_final_operation_v1'else'get_regular_consolation_closure_operation_v1'end;
 execute format('select public.%I($1,$2,$3,$4,$5,$6)',lookup)into r using actor,sid,tid,eid,op,request;
 if r->>'status'is distinct from'unknown'or r->>'code'is distinct from'operation_not_found'then return r;end if;
 -- Any other/incomplete known journal is ambiguous, never declared no effect.
 foreach journal in array array['manual_pool_final_authorizations_v1','modern_event_final_operations_v1','regular_consolation_final_operations_v1','modern_event_closures_v1','regular_consolation_closures_v1','selected_step_pool_operations_v3','selected_step_award_operations_v3','modern_prize_award_operations_v2','manual_final_authorizations_v1','native_optional_final_operations_v2','native_playoff_finance_write_operations_v1','native_optional_income_operations_v2']loop
  execute format('select exists(select 1 from app.%I where actor_id=$1 and operation_id=$2)',journal)into present using actor,op;if present then return jsonb_build_object('status','unknown','code','legacy_operation_history_requires_review');end if;
 end loop;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object('status','unknown','code','legacy_operation_history_requires_review');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception 'terminal_authorization_changed';end if;
 r:=jsonb_build_object('kind','closeout-terminal-retirement-v17','status','retired_no_effect','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,'operationId',op,'stage',stage,'request',request,'reason',reason,'moneyMoved',false,'payoutAuthorized',false,'officialMrpAwarded',false,'accSubmissionPerformed',false);
 insert into app.closeout_terminal_retirements_v17(actor_id,operation_id,session_id,tournament_id,event_id,stage,request,result,reason)values(actor,op,sid,tid,eid,stage,request,r,reason);
 return r;
end$$;
create function app.get_closeout_terminal_v17(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare prior app.closeout_terminal_retirements_v17%rowtype;begin
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if not found then return jsonb_build_object('status','unknown','code','terminal_operation_not_found');end if;
 if prior.tournament_id<>tid or prior.event_id<>eid or prior.stage<>stage or prior.request is distinct from request or tid is null or eid is null or stage is null then return jsonb_build_object('status','rejected','code','operation_conflict');end if;
 return prior.result;
end$$;
revoke all on function app.closeout_retirement_enabled_v17(),app.assert_closeout_operation_open_v17(uuid,uuid),app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text),app.get_closeout_terminal_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;

-- LOCAL PROPOSAL ONLY; default closed. Not hosted clearance.
do $patch$ declare target regprocedure:='app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'b54cb0b9ce8e672ce1ceee5644879120514ca0bb4c3cf8d9829ef6f2cd817a82' then raise exception 'terminal_writer_preimage_mismatch: app.record_manual_pool_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.manual_pool_final_authorizations_v1%rowtype;s jsonb;inner_request jsonb;r jsonb;proof jsonb;result jsonb;h text;begin
 if app.manual_pool_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''poolProposalRevisionId'',''expectedPoolSourceDigest'',''regularAwardSetId'',''fundReviewId'',''reviewed'',''reason''])is distinct from true
  or request->>''kind''is distinct from''manual-pool-finalize-v1''or request->''reviewed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or jsonb_typeof(request->''expectedPoolSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPoolSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''selected-step-pool-op-v3:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''manual-pool-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.manual_pool_final_authorizations_v1 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select o.result into result from app.manual_pool_final_outcomes_v1 o where o.actor_id=actor and o.operation_id=op;return coalesce(result,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));
 end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_manual_pool_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''or s->>''poolProposalRevisionId''is distinct from request->>''poolProposalRevisionId''or s#>>''{poolSource,sourceDigest}''is distinct from request->>''expectedPoolSourceDigest''
  or s->>''regularAwardSetId''is distinct from request->>''regularAwardSetId''or s->>''fundReviewId''is distinct from request->>''fundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''pool_final_already_recorded'');end if;
 inner_request:=jsonb_build_object(''kind'',''selected-step-pool-finalize-v3'',''proposalRevisionId'',s->''poolProposalRevisionId'',''expectedSourceDigest'',s#>''{poolSource,sourceDigest}'',''reason'',request->''reason'',''reviewed'',true);
 begin
  insert into app.manual_pool_final_authorizations_v1(actor_id,operation_id,tournament_id,event_id,session_id,request,request_hash,source_digest,source_capture,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id)
   values(actor,op,tid,eid,sid,request,h,s->>''sourceDigest'',s,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,(s->>''poolProposalRevisionId'')::uuid);
  r:=app.record_selected_step_pool_v3(actor,tid,eid,op,inner_request);
  if r->>''status''is distinct from''awards_recorded_unpaid''then raise exception using errcode=''ZMP01'',message=''inner_not_accepted'';end if;
  proof:=app.current_manual_pool_result_v1(actor,sid,tid,eid);
  if proof->>''status''is distinct from''source_available''or proof->''finalId''is distinct from r->''finalId''or proof->''sourceCapture''is distinct from s->''poolSource'' or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''manual_pool_postcondition_failed'';end if;
  result:=jsonb_build_object(''kind'',''manual-pool-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''sourceDigest'',s->''sourceDigest'',''poolFinalId'',r->''finalId'',''innerReceipt'',r,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false);
  insert into app.manual_pool_final_outcomes_v1 values(actor,op,result);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''manual_pool_final_v1'',(r->>''finalId'')::uuid,''approved_unpaid'',result||jsonb_build_object(''sessionId'',sid));
  set constraints app.manual_pool_operation_fk immediate;
 exception when sqlstate''ZMP01''then return coalesce(r,jsonb_build_object(''status'',''rejected'',''code'',''pool_final_unavailable''));end;
 return result;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'fea750fb09df6300053b9575633b284a24ef2e57abc9def9a365416f20a85f70' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_event_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.modern_event_final_operations_v1%rowtype;s jsonb;h text;r jsonb;final_id uuid:=extensions.gen_random_uuid();k text;begin
 if app.modern_event_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'',''approved'',''reason''])is distinct from true
  or request->>''kind''is distinct from''modern-event-finalize-v1''or request->''approved''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'']loop if jsonb_typeof(request->k)is distinct from''string''or coalesce(request->>k,'''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;end loop;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-event-final:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''modern-event-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.modern_event_final_operations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into r from app.modern_event_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''event_finalization_already_recorded'');end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)or exists(select 1 from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_modern_event_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''poolProposalRevisionId'',''poolFinalId'']loop if s->k is distinct from request->k then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.modern_event_final_operations_v1 values(actor,op,tid,eid,sid,request,h);
 insert into app.modern_event_final_snapshots_v1(id,tournament_id,event_id,actor_id,operation_id,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,pool_proposal_id,pool_final_id,source_digest,source_capture,reason)
 values(final_id,tid,eid,actor,op,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,(s->>''poolProposalRevisionId'')::uuid,(s->>''poolFinalId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 r:=jsonb_build_object(''kind'',''modern-event-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''snapshotId'',final_id,''sourceDigest'',s->''sourceDigest'',''historicalReceipt'',true,''currentSourceVerified'',false,
  ''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false,''registrationOverridesBlocking'',false);
 insert into app.modern_event_final_outcomes_v1 values(actor,op,r);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_event_final_v1'',final_id,''approved_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid));
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'0d7aed515cd10a1ba8b45390cf015aaebb1f12a45eaa74ed81067436b4703458' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_event_closure_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.modern_event_closures_v1%rowtype;w jsonb;r jsonb;inner_result jsonb;close_row app.event_play_closes%rowtype;new_id uuid:=extensions.gen_random_uuid();begin
 if app.modern_event_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''snapshotId'',''confirmed'',''reason''])is distinct from true or request->>''kind''is distinct from''modern-event-close-v1''or request->''confirmed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true or length(request->>''reason'')>1000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 -- Same order as existing lifecycle mutation. Try locks never wait through a
 -- different operation''s lock-order inversion. Scope lock also serializes funds.
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-play-gate:''||eid::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.modern_event_closures_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.request=request then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 if exists(select 1 from app.modern_event_closures_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
 if w->>''status''is distinct from''review''or w->''currentSourceVerified''is distinct from''true''::jsonb or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 begin
  inner_result:=public.close_event_play_v1(actor,tid,eid,request->>''reason'',true,op);
  if inner_result->>''status''not in(''event_play_closed'',''already_closed'')or inner_result->>''status''is null then raise exception using errcode=''ZMC01'',message=''event_close_refused'';end if;
  select*into close_row from app.event_play_closes where tournament_id=tid and event_id=eid order by sequence_number desc limit 1;
  if close_row.id is null or close_row.action<>''closed''or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''event_close_postcondition_failed'';end if;
  -- Close changes no captured sporting playState; revalidate the exact snapshot
  -- after the real lifecycle writer rather than assuming its result is enough.
  w:=app.current_modern_event_closure_v1(actor,sid,tid,eid);
  if w->>''status''is distinct from''review''or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then raise exception''event_close_source_changed'';end if;
  r:=jsonb_build_object(''kind'',''modern-event-close-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''closureId'',new_id,''snapshotId'',request->''snapshotId'',''sourceDigest'',request->''expectedSourceDigest'',''closeState'',''closed'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
  insert into app.modern_event_closures_v1(id,actor_id,session_id,operation_id,tournament_id,event_id,snapshot_id,play_close_id,request,result)values(new_id,actor,sid,op,tid,eid,(request->>''snapshotId'')::uuid,close_row.id,request,r);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_event_closure_v1'',new_id,''event_closed_against_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid,''playCloseId'',close_row.id));
 exception when sqlstate''ZMC01''then return coalesce(inner_result,jsonb_build_object(''status'',''rejected'',''code'',''event_close_refused''));end;
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'226cd1ee666ca4326a6874c7be5259f63947376ce704f6c2214e29a8ffd04fba' then raise exception 'terminal_writer_preimage_mismatch: app.record_regular_consolation_final_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.regular_consolation_final_operations_v1%rowtype;s jsonb;h text;r jsonb;final_id uuid:=extensions.gen_random_uuid();k text;begin
 if app.regular_consolation_finalization_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'',''approved'',''reason''])is distinct from true
  or request->>''kind''is distinct from''regular-consolation-finalize-v1''or request->''approved''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true
  or jsonb_typeof(request->''expectedSourceDigest'')is distinct from''string''or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'']loop if jsonb_typeof(request->k)is distinct from''string''or coalesce(request->>k,'''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;end loop;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''regular-consolation-final:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''regular-consolation-final-request-v1'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.regular_consolation_final_operations_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into r from app.regular_consolation_final_outcomes_v1 where actor_id=actor and operation_id=op;return coalesce(r,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_event_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''other_event_finalization_already_recorded'');end if;
 if exists(select 1 from app.regular_consolation_final_snapshots_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''event_finalization_already_recorded'');end if;
 if exists(select 1 from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op)or exists(select 1 from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 s:=app.current_regular_consolation_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->>''sourceDigest''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 foreach k in array array[''qualificationId'',''ownershipRevisionId'',''prizeRevisionId'',''fundReviewId'',''regularAwardSetId'']loop if s->k is distinct from request->k then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;end loop;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.regular_consolation_final_operations_v1 values(actor,op,tid,eid,sid,request,h);
 insert into app.regular_consolation_final_snapshots_v1(id,tournament_id,event_id,actor_id,operation_id,qualification_id,ownership_revision_id,prize_revision_id,fund_review_id,regular_award_set_id,source_digest,source_capture,reason)
 values(final_id,tid,eid,actor,op,(s->>''qualificationId'')::uuid,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeRevisionId'')::uuid,(s->>''fundReviewId'')::uuid,(s->>''regularAwardSetId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 r:=jsonb_build_object(''kind'',''regular-consolation-final-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''snapshotId'',final_id,''sourceDigest'',s->''sourceDigest'',''historicalReceipt'',true,''currentSourceVerified'',false,
  ''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false,''registrationOverridesBlocking'',false);
 insert into app.regular_consolation_final_outcomes_v1 values(actor,op,r);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''regular_consolation_final_v1'',final_id,''approved_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid));
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'dde55f6c984b65239c5bdb7a9149489b2d122529d4145fc2e6928c722e64228b' then raise exception 'terminal_writer_preimage_mismatch: app.record_regular_consolation_closure_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.regular_consolation_closures_v1%rowtype;w jsonb;r jsonb;inner_result jsonb;close_row app.event_play_closes%rowtype;new_id uuid:=extensions.gen_random_uuid();begin
 if app.regular_consolation_closure_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null or app.event_prize_exact_keys_source_v1(request,array[''kind'',''expectedSourceDigest'',''snapshotId'',''confirmed'',''reason''])is distinct from true or request->>''kind''is distinct from''regular-consolation-close-v1''or request->''confirmed''is distinct from''true''::jsonb or app.valid_playoff_prize_proposal_reason_v2(request->''reason'')is distinct from true or length(request->>''reason'')>1000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 -- Same order as existing lifecycle mutation. Try locks never wait through a
 -- different operation''s lock-order inversion. Scope lock also serializes funds.
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-play-gate:''||eid::text,0))or not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 select*into prior from app.regular_consolation_closures_v1 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.request=request then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 if exists(select 1 from app.regular_consolation_closures_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 w:=app.current_regular_consolation_closure_v1(actor,sid,tid,eid);
 if w->>''status''is distinct from''review''or w->''currentSourceVerified''is distinct from''true''::jsonb or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''review_source_changed'');end if;
 begin
  inner_result:=public.close_event_play_v1(actor,tid,eid,request->>''reason'',true,op);
  if inner_result->>''status''not in(''event_play_closed'',''already_closed'')or inner_result->>''status''is null then raise exception using errcode=''ZMC01'',message=''event_close_refused'';end if;
  select*into close_row from app.event_play_closes where tournament_id=tid and event_id=eid order by sequence_number desc limit 1;
  if close_row.id is null or close_row.action<>''closed''or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception''event_close_postcondition_failed'';end if;
  -- Close changes no captured sporting playState; revalidate the exact snapshot
  -- after the real lifecycle writer rather than assuming its result is enough.
  w:=app.current_regular_consolation_closure_v1(actor,sid,tid,eid);
  if w->>''status''is distinct from''review''or w->>''snapshotId''is distinct from request->>''snapshotId''or w#>>''{source,sourceDigest}''is distinct from request->>''expectedSourceDigest''then raise exception''event_close_source_changed'';end if;
  r:=jsonb_build_object(''kind'',''regular-consolation-close-receipt-v1'',''status'',''accepted'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''closureId'',new_id,''snapshotId'',request->''snapshotId'',''sourceDigest'',request->''expectedSourceDigest'',''closeState'',''closed'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
  insert into app.regular_consolation_closures_v1(id,actor_id,session_id,operation_id,tournament_id,event_id,snapshot_id,play_close_id,request,result)values(new_id,actor,sid,op,tid,eid,(request->>''snapshotId'')::uuid,close_row.id,request,r);
  insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''regular_consolation_closure_v1'',new_id,''event_closed_against_unpaid_snapshot'',r||jsonb_build_object(''sessionId'',sid,''playCloseId'',close_row.id));
 exception when sqlstate''ZMC01''then return coalesce(inner_result,jsonb_build_object(''status'',''rejected'',''code'',''event_close_refused''));end;
 return r;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'c11e54f960473c06f6e4f19569233378d0564f45dd07345a57264c8a952e891a' then raise exception 'terminal_writer_preimage_mismatch: app.record_selected_step_pool_v3';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.selected_step_pool_operations_v3%rowtype;head app.selected_step_pool_revisions_v3%rowtype;s jsonb;h text;result jsonb;revision_id uuid;v_final_id uuid;pool jsonb;r jsonb;action text;ver integer;
begin
 if app.selected_step_pool_journal_enabled_v3()is distinct from true or app.native_optional_finance_service_access_v2(actor,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 if op is null or jsonb_typeof(request)is distinct from''object''then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 action:=request->>''kind'';
 if action=''selected-step-pool-save-v3''and(jsonb_typeof(request->''expectedVersion'')is distinct from''number''or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$'')then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 if op is null or jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>5 or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or jsonb_typeof(request->''reason'')is distinct from''string''
  or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000
  or action not in(''selected-step-pool-save-v3'',''selected-step-pool-finalize-v3'')or action is null
  or(action=''selected-step-pool-save-v3''and(not(request?&array[''kind'',''expectedVersion'',''expectedSourceDigest'',''reason'',''reviewed''])or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$''or(request->>''expectedVersion'')::numeric>=2147483647))
  or(action=''selected-step-pool-finalize-v3''and(not(request?&array[''kind'',''proposalRevisionId'',''expectedSourceDigest'',''reason'',''reviewed''])or coalesce(request->>''proposalRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''))then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''selected-step-pool-op-v3:''||actor::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director''for key share nowait;if not found then return null;end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-pool-operation-v3'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.selected_step_pool_operations_v3 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id<>tid or prior.event_id<>eid or prior.request_hash<>h or prior.request is distinct from request then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select x.result into result from app.selected_step_pool_outcomes_v3 x where x.actor_id=actor and x.operation_id=op;
  if result is null then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete'');end if;return result;end if;
 if exists(select 1 from app.selected_step_pool_finals_v3 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''pool_awards_already_recorded'');end if;
 if app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)
  or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''competing_financial_liability'');end if;
 s:=app.get_selected_step_pool_source_v3(actor,tid,eid);
 if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''current_source_required''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 select*into head from app.selected_step_pool_revisions_v3 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if action=''selected-step-pool-save-v3''and coalesce(head.version,0)<>(request->>''expectedVersion'')::integer then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;
 if action=''selected-step-pool-finalize-v3''and(head.id is null or head.id::text is distinct from request->>''proposalRevisionId''or head.source_digest is distinct from s->>''sourceDigest''or head.source_capture is distinct from s)then return jsonb_build_object(''status'',''rejected'',''code'',''proposal_or_source_changed'');end if;
 insert into app.selected_step_pool_operations_v3 values(actor,op,tid,eid,request,h);
 if action=''selected-step-pool-save-v3''then
  revision_id:=extensions.gen_random_uuid();ver:=coalesce(head.version,0)+1;
  insert into app.selected_step_pool_revisions_v3(id,tournament_id,event_id,version,prior_revision_id,actor_id,operation_id,ownership_revision_id,prize_snapshot_id,qualification_id,source_digest,source_capture,reason)
   values(revision_id,tid,eid,ver,head.id,actor,op,(s->>''ownershipRevisionId'')::uuid,(s->>''prizeSnapshotId'')::uuid,(s->>''qualificationResultVersionId'')::uuid,s->>''sourceDigest'',s,request->>''reason'');
 else
  revision_id:=head.id;ver:=head.version;v_final_id:=extensions.gen_random_uuid();
  insert into app.selected_step_pool_finals_v3(id,tournament_id,event_id,proposal_revision_id,actor_id,operation_id,source_digest,source_capture,q_minor,side_minor,total_minor,reason)
   values(v_final_id,tid,eid,head.id,actor,op,s->>''sourceDigest'',s,(s->>''qMinor'')::bigint,(s->>''sideMinor'')::bigint,(s->>''totalMinor'')::bigint,request->>''reason'');
  for pool in select value from jsonb_array_elements(s->''pools'')loop
   for r in select value from jsonb_array_elements(pool->''recipients'')loop
    insert into app.selected_step_pool_recipients_v3 values(v_final_id,tid,eid,(pool->>''poolId'')::uuid,pool->>''kind'',(r->>''participantId'')::uuid,r->>''name'',r->>''tournamentPlayerId'',(pool#>>''{policy,roundingUnitMinor}'')::integer,(r->>''amountMinor'')::bigint);
   end loop;
   if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id and pool_id=(pool->>''poolId'')::uuid)<>(pool#>>''{calculation,fundMinor}'')::bigint then raise exception''selected_pool_fund_postcondition_failed'';end if;
  end loop;
  if(select sum(amount_minor)from app.selected_step_pool_recipients_v3 where final_id=v_final_id)<>(s->>''totalMinor'')::bigint then raise exception''selected_pool_total_postcondition_failed'';end if;
 end if;
 result:=jsonb_build_object(''kind'',''selected-step-pool-receipt-v3'',''status'',case when action=''selected-step-pool-save-v3''then''proposal_saved''else''awards_recorded_unpaid''end,
  ''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''revisionId'',revision_id,''version'',ver,''finalId'',v_final_id,''sourceDigest'',s->>''sourceDigest'',
  ''qMinor'',s->''qMinor'',''sideMinor'',s->''sideMinor'',''totalMinor'',s->''totalMinor'',''liabilityScope'',''optional_pools_only'',''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.selected_step_pool_outcomes_v3 values(actor,op,result);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_pool_v3'',coalesce(v_final_id,revision_id),case when v_final_id is null then''proposal_saved''else''awards_recorded_unpaid''end,result);
 return result;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'816efa66a1123d53036f5882ac81ea68f8e3adf501f65cf255c92a657a13b35a' then raise exception 'terminal_writer_preimage_mismatch: app.record_modern_prize_awards_v2';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare actor uuid:=auth.uid();h text;prior app.modern_prize_award_operations_v2%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if actor is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if app.modern_prize_awards_enabled_v2()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)=''object''then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])else true end)or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPrizeRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''expectedFundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in(''director'',''co_director'')order by role for key share nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''modern-prize-award-request-v2'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.modern_prize_award_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into response from app.modern_prize_award_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.modern_prize_award_sets_v2 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''existing_awards'');end if;
 s:=app.current_modern_prize_award_source_v2(tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''source_unavailable''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,capture,latestReview,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 unit:=(s->>''roundingUnitMinor'')::integer;
 insert into app.modern_prize_award_operations_v2 values(actor,op,tid,eid,request,h);
 insert into app.modern_prize_award_sets_v2(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s,s->''plan'',unit,(s->>''totalMinor'')::bigint,jsonb_array_length(s->''recipients''),request->>''reason'')returning id into award;
 for g in select value from jsonb_array_elements(s->''groups'')loop insert into app.modern_prize_award_groups_v2 values(award,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->''recipients'')loop insert into app.modern_prize_award_recipients_v2 values(award,tid,eid,(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',r->>''tournamentPlayerId'',(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,(r->>''included'')::boolean,(r->>''amountMinor'')::bigint,unit);end loop;
 if(select count(*)from app.modern_prize_award_groups_v2 where award_set_id=award)<>jsonb_array_length(s->''groups'')or exists(select 1 from jsonb_array_elements(s->''recipients'')x where not exists(select 1 from app.modern_prize_award_recipients_v2 y where y.award_set_id=award and y.participant_id::text=x->>''participantId''and y.profile_id::text=x->>''profileId''and y.display_name=x->>''displayName''and y.tournament_player_id=x->>''tournamentPlayerId''and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.included=(x->>''included'')::boolean and y.amount_minor=(x->>''amountMinor'')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->''groups'')x where not exists(select 1 from app.modern_prize_award_groups_v2 y where y.award_set_id=award and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.people=(x->>''people'')::integer and y.included=(x->>''included'')::boolean and y.per_person_minor=(x->>''perPersonMinor'')::bigint and y.group_total_minor=(x->>''groupTotalMinor'')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>(s->>''totalMinor'')::bigint or(select count(*)from app.modern_prize_award_recipients_v2 where award_set_id=award)<>jsonb_array_length(s->''recipients'')or(select sum(group_total_minor)from app.modern_prize_award_groups_v2 where award_set_id=award)<>(s->>''totalMinor'')::bigint then raise exception''modern_award_postcondition_failed'';end if;
 response:=jsonb_build_object(''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''status'',''accepted'',''kind'',''modern-prize-award-receipt-v2'',''awardSetId'',award,''sourceDigest'',s->>''sourceDigest'',''prizeRevisionId'',request->>''expectedPrizeRevisionId'',''fundReviewId'',request->>''expectedFundReviewId'',''totalMinor'',s->''totalMinor'',''recordedUnpaid'',true,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.modern_prize_award_outcomes_v2 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''modern_prize_awards_v2'',award,''recorded_unpaid'',response);
 return response;
 exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'ef2a843d5e7dcc6e2ff541078b33912b1dc8b86ffc63491105d0e582cea8020b' then raise exception 'terminal_writer_preimage_mismatch: app.record_selected_step_awards_v3';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare h text;prior app.selected_step_award_operations_v3%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if app.selected_step_awards_enabled_v3()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)=''object''then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])else true end)or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPrizeRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''expectedFundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in(''director'',''co_director'')order by role for key share nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-award-request-v3'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into response from app.selected_step_award_outcomes_v3 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''existing_awards'');end if;
 s:=app.current_selected_step_award_source_v3(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''source_unavailable''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 unit:=(s->>''roundingUnitMinor'')::integer; if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.selected_step_award_operations_v3 values(actor,op,tid,eid,request,h);
 insert into app.selected_step_award_sets_v3(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s,s->''plan'',unit,(s->>''totalMinor'')::bigint,jsonb_array_length(s->''recipients''),request->>''reason'')returning id into award;
 for g in select value from jsonb_array_elements(s->''groups'')loop insert into app.selected_step_award_groups_v3 values(award,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->''recipients'')loop insert into app.selected_step_award_recipients_v3 values(award,tid,eid,(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',r->>''tournamentPlayerId'',(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,(r->>''included'')::boolean,(r->>''amountMinor'')::bigint,unit);end loop;
 if(select count(*)from app.selected_step_award_groups_v3 where award_set_id=award)<>jsonb_array_length(s->''groups'')or exists(select 1 from jsonb_array_elements(s->''recipients'')x where not exists(select 1 from app.selected_step_award_recipients_v3 y where y.award_set_id=award and y.participant_id::text=x->>''participantId''and y.profile_id::text=x->>''profileId''and y.display_name=x->>''displayName''and y.tournament_player_id=x->>''tournamentPlayerId''and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.included=(x->>''included'')::boolean and y.amount_minor=(x->>''amountMinor'')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->''groups'')x where not exists(select 1 from app.selected_step_award_groups_v3 y where y.award_set_id=award and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.people=(x->>''people'')::integer and y.included=(x->>''included'')::boolean and y.per_person_minor=(x->>''perPersonMinor'')::bigint and y.group_total_minor=(x->>''groupTotalMinor'')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.selected_step_award_recipients_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint or(select count(*)from app.selected_step_award_recipients_v3 where award_set_id=award)<>jsonb_array_length(s->''recipients'')or(select sum(group_total_minor)from app.selected_step_award_groups_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint then raise exception''modern_award_postcondition_failed'';end if;
 response:=jsonb_build_object(''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''status'',''accepted'',''kind'',''selected-step-award-receipt-v3'',''awardSetId'',award,''sourceDigest'',s->>''sourceDigest'',''prizeRevisionId'',request->>''expectedPrizeRevisionId'',''fundReviewId'',request->>''expectedFundReviewId'',''totalMinor'',s->''totalMinor'',''recordedUnpaid'',true,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.selected_step_award_outcomes_v3 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_awards_v3'',award,''recorded_unpaid'',response||jsonb_build_object(''sessionId'',sid));
 return response;
 exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'3de6386b7fb12429fffc86fbed3d507828b218193201be5304573454a82731d9' then raise exception 'terminal_writer_preimage_mismatch: public.close_event_play_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare
  v_reason text := trim(coalesce(p_reason, ''''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_readiness jsonb; v_scheduled integer; v_resolved integer; v_unresolved integer; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>''role''), '''') <> ''service_role'' then
    raise exception using errcode=''P0001'', message=''server-only close event'';
  end if;
  -- start_event_play_v1 requires the same explicit confirmation server side. A
  -- tick that exists only in the browser is not a gate, it is a decoration, and
  -- this operation ends scoring for a whole event.
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or p_confirmed is distinct from true or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    ''close_event_play_v1'', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_reason, p_confirmed, p_operation_id::text)::text,''utf8''),''sha256''),''hex'');
 perform app.assert_closeout_operation_open_v17(p_actor_id,p_operation_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||'':''||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''event-play-gate:''||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type=''close_event_play_v1'' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status=''open'' for update;
  if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable''); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in(''director'',''co_director'')) then
    return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object(''status'',''rejected'',''code'',''event_unavailable'');
  end if;
  if not exists(select 1 from app.event_play_starts started where started.event_id=p_event_id) then
    if exists(select 1 from app.event_team_starts team_started where team_started.event_id=p_event_id) then
      return jsonb_build_object(''status'',''rejected'',''code'',''team_event_unsupported'');
    end if;
    return jsonb_build_object(''status'',''rejected'',''code'',''event_not_started'');
  end if;
  if app.event_play_close_state_v1(p_event_id)=''closed'' then
    return jsonb_build_object(''status'',''already_closed'',''eventId'',p_event_id);
  end if;

  v_readiness := app.event_play_close_readiness_v1(p_event_id);
  v_scheduled := (v_readiness->>''scheduledGames'')::integer;
  v_resolved := (v_readiness->>''resolvedGames'')::integer;
  v_unresolved := (v_readiness->>''unresolvedGames'')::integer;
  if v_scheduled=0 then
    return jsonb_build_object(''status'',''rejected'',''code'',''no_scheduled_games'');
  end if;
  -- The counts travel with the refusal. A director told only "not ready" has to
  -- go and count forty games by eye to find the two that are still open.
  if v_unresolved>0 then
    return jsonb_build_object(''status'',''rejected'',''code'',''games_unresolved'',
      ''scheduledGames'',v_scheduled,''resolvedGames'',v_resolved,''unresolvedGames'',v_unresolved);
  end if;

  v_response := jsonb_build_object(''status'',''event_play_closed'',''eventId'',p_event_id,
    ''closeState'',''closed'',''scheduledGames'',v_scheduled,''resolvedGames'',v_resolved,''unresolvedGames'',0);

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,''close_event_play_v1'',p_event_id,
    v_hash,p_operation_id,''accepted'',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_closes(tournament_id,event_id,action,reason,scheduled_game_count,
    resolved_game_count,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,''closed'',v_reason,v_scheduled,v_resolved,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,''event_play_close'',p_event_id,''event_play_closed'',
    jsonb_build_object(''closeState'',''open'',''pauseState'',app.event_play_pause_state_v1(p_event_id)),
    v_response || jsonb_build_object(''reason'',v_reason));

  return v_response;
end;
');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'b74c3b41a2cff74599cf339ca1d0f05353f744c668b906529e7882a715c17dec' then raise exception 'terminal_writer_preimage_mismatch: app.record_manual_final_inner_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare h text;prior app.selected_step_award_operations_v3%rowtype;s jsonb;award uuid;g jsonb;r jsonb;unit integer;response jsonb;begin
 if app.selected_step_awards_enabled_v3()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if app.selected_step_awards_enabled_v3()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if tid is null or eid is null or op is null or (case when jsonb_typeof(request)=''object''then(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])else true end)or request->''reviewed''is distinct from''true''::jsonb
  or coalesce(request->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''expectedPrizeRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''expectedFundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role in(''director'',''co_director'')order by role for key share nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''selected-step-award-request-v3'',actor,tid,eid,op,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request<>request or prior.request_hash<>h then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select result into response from app.selected_step_award_outcomes_v3 where actor_id=actor and operation_id=op;return coalesce(response,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));end if;
 if exists(select 1 from app.selected_step_award_sets_v3 where tournament_id=tid and event_id=eid)or app.legacy_financial_liability_exists_v1(tid,eid)is distinct from false or exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)or exists(select 1 from app.native_optional_final_award_sets_v2 where tournament_id=tid and event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''existing_awards'');end if;
 s:=app.current_manual_final_source_v1(actor,sid,tid,eid);if s->>''status''=''retry_exact''then return s;end if;
 if s->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(s->>''code'',''source_unavailable''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 unit:=(s->>''roundingUnitMinor'')::integer; if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 insert into app.selected_step_award_operations_v3 values(actor,op,tid,eid,request,h);
 insert into app.selected_step_award_sets_v3(tournament_id,event_id,actor_id,operation_id,prize_revision_id,fund_review_id,source_digest,source_capture,plan,rounding_unit_minor,total_minor,recipient_count,reason)
 values(tid,eid,actor,op,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s,s->''plan'',unit,(s->>''totalMinor'')::bigint,jsonb_array_length(s->''recipients''),request->>''reason'')returning id into award;
 for g in select value from jsonb_array_elements(s->''groups'')loop insert into app.selected_step_award_groups_v3 values(award,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint,unit);end loop;
 for r in select value from jsonb_array_elements(s->''recipients'')loop insert into app.selected_step_award_recipients_v3 values(award,tid,eid,(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',r->>''tournamentPlayerId'',(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,(r->>''included'')::boolean,(r->>''amountMinor'')::bigint,unit);end loop;
 if(select count(*)from app.selected_step_award_groups_v3 where award_set_id=award)<>jsonb_array_length(s->''groups'')or exists(select 1 from jsonb_array_elements(s->''recipients'')x where not exists(select 1 from app.selected_step_award_recipients_v3 y where y.award_set_id=award and y.participant_id::text=x->>''participantId''and y.profile_id::text=x->>''profileId''and y.display_name=x->>''displayName''and y.tournament_player_id=x->>''tournamentPlayerId''and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.included=(x->>''included'')::boolean and y.amount_minor=(x->>''amountMinor'')::bigint and y.rounding_unit_minor=unit))or exists(select 1 from jsonb_array_elements(s->''groups'')x where not exists(select 1 from app.selected_step_award_groups_v3 y where y.award_set_id=award and y.first_place=(x->>''firstPlace'')::integer and y.last_place=(x->>''lastPlace'')::integer and y.people=(x->>''people'')::integer and y.included=(x->>''included'')::boolean and y.per_person_minor=(x->>''perPersonMinor'')::bigint and y.group_total_minor=(x->>''groupTotalMinor'')::bigint and y.rounding_unit_minor=unit))or(select sum(amount_minor)from app.selected_step_award_recipients_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint or(select count(*)from app.selected_step_award_recipients_v3 where award_set_id=award)<>jsonb_array_length(s->''recipients'')or(select sum(group_total_minor)from app.selected_step_award_groups_v3 where award_set_id=award)<>(s->>''totalMinor'')::bigint then raise exception''modern_award_postcondition_failed'';end if;
 response:=jsonb_build_object(''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''request'',request,''requestHash'',h,''status'',''accepted'',''kind'',''selected-step-award-receipt-v3'',''awardSetId'',award,''sourceDigest'',s->>''sourceDigest'',''prizeRevisionId'',request->>''expectedPrizeRevisionId'',''fundReviewId'',request->>''expectedFundReviewId'',''totalMinor'',s->''totalMinor'',''recordedUnpaid'',true,''historicalReceipt'',true,''currentSourceVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false);
 insert into app.selected_step_award_outcomes_v3 values(actor,op,tid,eid,response);
 insert into app.audit_events(tournament_id,actor_profile_id,entity_type,entity_id,action,after_state)values(tid,actor,''selected_step_awards_v3'',award,''recorded_unpaid'',response||jsonb_build_object(''sessionId'',sid));
 return response;
 exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'ee85088b4dd76be7f25ddd372fd1472cd39029dad87e5db6938a11b17da152ff' then raise exception 'terminal_writer_preimage_mismatch: app.record_manual_final_awards_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.selected_step_award_operations_v3%rowtype;s jsonb;outcome jsonb;set_id uuid;begin
 if app.manual_final_awards_enabled_v1()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_unsupported'');end if;
 if op is null then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(''modern-prize-v2:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 -- Exact committed history is recoverable without promoting a stale source or
 -- inserting another admission. No stored request bytes are substituted.
 select*into prior from app.selected_step_award_operations_v3 where actor_id=actor and operation_id=op;
 if prior.operation_id is not null then
  if prior.tournament_id<>tid or prior.event_id<>eid or prior.request is distinct from request or not exists(select 1 from app.manual_final_authorizations_v1 a where a.actor_id=actor and a.operation_id=op and a.tournament_id=tid and a.event_id=eid)then return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
  select o.result into outcome from app.selected_step_award_outcomes_v3 o where o.actor_id=actor and o.operation_id=op and o.tournament_id=tid and o.event_id=eid;
  return coalesce(outcome,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));
 end if;
 if jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>5 or not(request?&array[''expectedSourceDigest'',''expectedPrizeRevisionId'',''expectedFundReviewId'',''reason'',''reviewed''])or request->''reviewed''is distinct from''true''::jsonb then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 s:=app.current_manual_final_source_v1(actor,sid,tid,eid);if s->>''status''is distinct from''source_available''then return coalesce(s,jsonb_build_object(''status'',''rejected'',''code'',''current_manual_award_proof_required''));end if;
 if s->''sourceDigest''is distinct from request->''expectedSourceDigest''or s#>''{prizeWorkspace,head,revisionId}''is distinct from request->''expectedPrizeRevisionId''or s#>''{fundSource,reviewId}''is distinct from request->''expectedFundReviewId''then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 begin
  insert into app.manual_final_authorizations_v1(actor_id,operation_id,tournament_id,event_id,session_id,qualification_id,prize_revision_id,fund_review_id,source_digest,source_capture)values(actor,op,tid,eid,sid,(s#>>''{fundSource,capture,sportingSource,qualification,resultVersionId}'')::uuid,(request->>''expectedPrizeRevisionId'')::uuid,(request->>''expectedFundReviewId'')::uuid,s->>''sourceDigest'',s);
  outcome:=app.record_manual_final_inner_v1(actor,sid,tid,eid,op,request);
  if outcome->>''status''is distinct from''accepted''then raise exception using errcode=''ZMM01'',message=''manual_award_attempt_not_recorded'';end if;
  set_id:=(outcome->>''awardSetId'')::uuid;
  if not exists(select 1 from app.selected_step_award_sets_v3 a join app.selected_step_award_outcomes_v3 o on o.actor_id=a.actor_id and o.operation_id=a.operation_id and o.tournament_id=a.tournament_id and o.event_id=a.event_id where a.id=set_id and a.actor_id=actor and a.operation_id=op and a.tournament_id=tid and a.event_id=eid and a.source_capture=s and o.result=outcome)
   then raise exception''manual_award_commit_postcondition_failed'';end if;
  set constraints app.manual_final_authorization_operation_fk immediate;
  return outcome;
 exception when sqlstate''ZMM01''then return coalesce(outcome,jsonb_build_object(''status'',''retry_exact'',''code'',''outcome_unknown''));end;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'e56cba4e77197594b326e712a4a9f3495d6f5721e21fcc72106047e91cf5c942' then raise exception 'terminal_writer_preimage_mismatch: app.record_native_optional_final_awards_v2';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.native_optional_final_operations_v2%rowtype;source_value jsonb;fund jsonb;regular jsonb;p jsonb;r jsonb;g jsonb;
 h text;result_value jsonb;award_id uuid:=extensions.gen_random_uuid();total numeric;count_rows integer;pool_key text;participant_row app.event_participants%rowtype;
begin
 if coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''),(nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb)->>''role'','''')<>''service_role''or actor is null or op is null then return null;end if;
 if app.native_optional_final_awards_enabled_v2()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director''for key share nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>10
  or not(request?&array[''kind'',''expectedVersion'',''fundReviewId'',''fundReviewVersion'',''sourceDigest'',''proposalRevisionId'',''ownershipRevisionId'',''recipientSourceDigest'',''reviewed'',''reason''])
  or request->>''kind''is distinct from''native-optional-final-awards-v2''or request->''expectedVersion''is distinct from''0''::jsonb or request->''reviewed''is distinct from''true''::jsonb
  or jsonb_typeof(request->''fundReviewVersion'')is distinct from''number''or coalesce(request->>''fundReviewVersion'','''')!~''^[1-9][0-9]{0,9}$''or(request->>''fundReviewVersion'')::numeric>2147483647
  or coalesce(request->>''fundReviewId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''proposalRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or coalesce(request->>''ownershipRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''sourceDigest'','''')!~''^[a-f0-9]{64}$''or coalesce(request->>''recipientSourceDigest'','''')!~''^[a-f0-9]{64}$''
  or jsonb_typeof(request->''reason'')is distinct from''string''or request->>''reason''is distinct from app.custom_payout_classification_text_v2(request->>''reason'')or app.event_settings_js_text_length_v3(request->>''reason'')not between 1 and 2000
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''native-optional-final-awards-v2'',actor,op,tid,eid,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.native_optional_final_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;
  select result into result_value from app.native_optional_final_outcomes_v2 where actor_id=actor and operation_id=op;
  return coalesce(result_value,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));
 end if;
 source_value:=app.native_optional_final_award_source_v2(actor,tid,eid);
 if source_value->>''status''=''retry_exact''then return source_value;end if;
 if source_value is null or source_value->>''status''is distinct from''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(source_value->>''code'',''source_unavailable''));end if;
 if source_value->>''sourceDigest''is distinct from request->>''sourceDigest''or source_value#>>''{fundReview,id}''is distinct from request->>''fundReviewId''
  or source_value#>>''{fundReview,version}''is distinct from request->>''fundReviewVersion''or source_value#>>''{fundSource,proposalRevisionId}''is distinct from request->>''proposalRevisionId''
  or source_value#>>''{fundSource,ownershipRevisionId}''is distinct from request->>''ownershipRevisionId''or source_value#>>''{fundSource,recipientSource,sourceDigest}''is distinct from request->>''recipientSourceDigest''
 then return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 fund:=source_value#>''{fundSource,funds}'';regular:=source_value->''regularProjection'';
 total:=(fund->>''regularFundMinor'')::numeric+(fund->>''qFundMinor'')::numeric+(fund->>''sideFundMinor'')::numeric;
 if total<0 or total>9007199254740991 or total+(fund->>''regularCostMinor'')::numeric is distinct from(fund->>''recordedReceiptsMinor'')::numeric then return jsonb_build_object(''status'',''rejected'',''code'',''nonconserving_awards'');end if;
 count_rows:=jsonb_array_length(regular->''recipients'');for p in select value from jsonb_array_elements(source_value->''optionalPools'')loop count_rows:=count_rows+jsonb_array_length(p->''rows'');end loop;
 if count_rows<1 or count_rows>10000 then return jsonb_build_object(''status'',''rejected'',''code'',''technical_resource_bound'');end if;
 insert into app.native_optional_final_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_final_award_sets_v2(id,tournament_id,event_id,version,fund_review_id,proposal_revision_id,ownership_revision_id,qualification_id,source_digest,source_capture,regular_minor,q_minor,side_minor,total_minor,recipient_count,actor_id,operation_id,reason)
 values(award_id,tid,eid,1,(request->>''fundReviewId'')::uuid,(request->>''proposalRevisionId'')::uuid,(request->>''ownershipRevisionId'')::uuid,
  (source_value#>>''{fundSource,recipientSource,playoff,qualificationResultVersionId}'')::uuid,source_value->>''sourceDigest'',source_value,
  (fund->>''regularFundMinor'')::bigint,(fund->>''qFundMinor'')::bigint,(fund->>''sideFundMinor'')::bigint,total::bigint,count_rows,actor,op,request->>''reason'');
 for g in select value from jsonb_array_elements(regular->''groups'')loop
  insert into app.native_optional_final_regular_groups_v2(award_set_id,tournament_id,event_id,first_place,last_place,people,included,per_person_minor,group_total_minor)
  values(award_id,tid,eid,(g->>''firstPlace'')::integer,(g->>''lastPlace'')::integer,(g->>''people'')::integer,(g->>''included'')::boolean,(g->>''perPersonMinor'')::bigint,(g->>''groupTotalMinor'')::bigint);
 end loop;
 for r in select value from jsonb_array_elements(regular->''recipients'')loop
  insert into app.native_optional_final_recipients_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,participant_id,profile_id,display_name,amount_minor,first_place,last_place,source_row)
  values(award_id,tid,eid,''regular'',''regular'',(r->>''participantId'')::uuid,(r->>''profileId'')::uuid,r->>''displayName'',(r->>''amountMinor'')::bigint,(r->>''firstPlace'')::integer,(r->>''lastPlace'')::integer,r);
 end loop;
 for p in select value from jsonb_array_elements(source_value->''optionalPools'')loop
  pool_key:=(p->>''kind'')||'':''||(p->>''poolId'');
  insert into app.native_optional_final_pools_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,q_pool_version_id,side_pool_id,q_review_id,side_review_id,source_digest,fund_minor,source_rows)
  values(award_id,tid,eid,pool_key,p->>''kind'',case when p->>''kind''=''q''then(p->>''poolId'')::uuid end,case when p->>''kind''=''side''then(p->>''poolId'')::uuid end,
   case when p->>''kind''=''q''then(p->>''reviewId'')::uuid end,case when p->>''kind''=''side''then(p->>''reviewId'')::uuid end,p->>''sourceDigest'',(p->>''fundMinor'')::bigint,p->''rows'');
  for r in select value from jsonb_array_elements(p->''rows'')loop
   select*into strict participant_row from app.event_participants ep where ep.id=(r->>''participantId'')::uuid and ep.event_id=eid and ep.tournament_id=tid;
   insert into app.native_optional_final_recipients_v2(award_set_id,tournament_id,event_id,fund_key,pool_kind,participant_id,profile_id,display_name,amount_minor,source_row)
   values(award_id,tid,eid,pool_key,p->>''kind'',participant_row.id,participant_row.profile_id,r->>''displayName'',(r->>''amountMinor'')::bigint,r);
  end loop;
 end loop;
 if(select coalesce(sum(amount_minor),0)from app.native_optional_final_recipients_v2 where award_set_id=award_id)<>total
  or(select count(*)from app.native_optional_final_recipients_v2 where award_set_id=award_id)<>count_rows
  or exists(select 1 from app.native_optional_final_pools_v2 pool where pool.award_set_id=award_id and pool.fund_minor<>(select coalesce(sum(rec.amount_minor),0)from app.native_optional_final_recipients_v2 rec where rec.award_set_id=pool.award_set_id and rec.fund_key=pool.fund_key))
 then raise exception''optional_final_award_write_inconsistent'';end if;
 result_value:=jsonb_build_object(''status'',''optional_final_awards_recorded_v2'',''awardSetId'',award_id,''version'',1,''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''sourceDigest'',source_value->>''sourceDigest'',
  ''regularMinor'',fund->''regularFundMinor'',''qMinor'',fund->''qFundMinor'',''sideMinor'',fund->''sideFundMinor'',''totalMinor'',total::bigint,''recipientCount'',count_rows,''awardStatus'',''recorded_unpaid'',''moneyMoved'',false,''payoutAuthorized'',false,''disbursementAuthorized'',false,''finalizationAuthorized'',false);
 insert into app.native_optional_final_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'c7eb4ed1bdbff318611866d728e3cff751372594a49c5da3846f127e72eb3bff' then raise exception 'terminal_writer_preimage_mismatch: app.record_native_playoff_final_awards_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare a uuid:=auth.uid();op uuid;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;
 prior_result jsonb;source_value jsonb;award_id uuid;group_value jsonb;recipient_value jsonb;reason_value text;
 response jsonb;legacy_exists boolean;
begin
 if a is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 if jsonb_typeof(request_value)is distinct from''object''or(select count(*)from jsonb_object_keys(request_value))<>9
  or not(request_value?&array[''kind'',''operationId'',''expectedVersion'',''expectedSourceDigest'',''expectedRecipientSourceDigest'',
   ''expectedFundSourceDigest'',''expectedProposalRevisionId'',''expectedFundReviewId'',''reason''])
  or request_value->>''kind''is distinct from''native-playoff-final-awards-v1''
  or coalesce(request_value->>''operationId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or request_value->''expectedVersion''is distinct from''0''::jsonb
  or coalesce(request_value->>''expectedSourceDigest'','''')!~''^[a-f0-9]{64}$''
  or coalesce(request_value->>''expectedRecipientSourceDigest'','''')!~''^[a-f0-9]{64}$''
  or coalesce(request_value->>''expectedFundSourceDigest'','''')!~''^[a-f0-9]{64}$''
  or coalesce(request_value->>''expectedProposalRevisionId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or coalesce(request_value->>''expectedFundReviewId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or jsonb_typeof(request_value->''reason'')is distinct from''string''
  or request_value->>''reason''<>app.custom_payout_classification_text_v2(request_value->>''reason'')
  or app.event_settings_js_text_length_v3(request_value->>''reason'')not between 1 and 2000 then
  return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 op:=(request_value->>''operationId'')::uuid;reason_value:=request_value->>''reason'';
 perform app.assert_closeout_operation_open_v17(a,op);
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in(''director'',''co_director'')order by role for key share nowait;
 if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(''native-playoff-finance-write-v1'',a,tid,eid,op,request_value)::text,''utf8''),''sha256''),''hex'');
 select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;
  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;
  if prior_result is null then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete'');end if;
  return prior_result||jsonb_build_object(''historicalReceipt'',true,''currentSourceVerified'',false);
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then
  return jsonb_build_object(''status'',''rejected'',''code'',''final_awards_already_recorded'');end if;
 legacy_exists:=app.legacy_financial_liability_exists_v1(tid,eid);
 if legacy_exists is distinct from false then return jsonb_build_object(''status'',''rejected'',''code'',''legacy_financial_liability_exists'');end if;
 source_value:=app.native_playoff_final_award_source_v1(tid,eid,a);
 if source_value->>''status''=''retry_exact''then return source_value;end if;
 if source_value->>''status''<>''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(source_value->>''code'',''source_unavailable''));end if;
 if request_value->>''expectedSourceDigest''is distinct from source_value->>''sourceDigest''
  or request_value->>''expectedRecipientSourceDigest''is distinct from source_value->>''recipientSourceDigest''
  or request_value->>''expectedFundSourceDigest''is distinct from source_value->>''fundSourceDigest''
  or request_value->>''expectedProposalRevisionId''is distinct from source_value#>>''{proposal,revisionId}''
  or request_value->>''expectedFundReviewId''is distinct from source_value#>>''{income,reviewId}''then
  return jsonb_build_object(''status'',''rejected'',''code'',''source_changed'');end if;
 insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
  values(a,op,tid,eid,request_value,request_hash);
 insert into app.native_playoff_final_award_sets_v1(tournament_id,event_id,version,proposal_revision_id,fund_review_id,
  qualification_result_version_id,recipient_source_digest,fund_source_digest,source_digest,source_capture,total_minor,
  recipient_count,reason,recorded_by,actor_id,operation_id)
 values(tid,eid,1,(source_value#>>''{proposal,revisionId}'')::uuid,(source_value#>>''{income,reviewId}'')::uuid,
  (source_value#>>''{proposal,qualificationResultVersionId}'')::uuid,source_value->>''recipientSourceDigest'',source_value->>''fundSourceDigest'',
  source_value->>''sourceDigest'',source_value,(source_value#>>''{projection,totalMinor}'')::bigint,
  jsonb_array_length(source_value#>''{projection,recipients}''),reason_value,a,a,op)returning id into award_id;
 for group_value in select value from jsonb_array_elements(source_value#>''{projection,groups}'')loop
  insert into app.native_playoff_final_award_groups_v1(award_set_id,tournament_id,event_id,first_place,last_place,people,included,per_person_minor,group_total_minor)
  values(award_id,tid,eid,(group_value->>''firstPlace'')::integer,(group_value->>''lastPlace'')::integer,(group_value->>''people'')::integer,
   (group_value->>''included'')::boolean,(group_value->>''perPersonMinor'')::bigint,(group_value->>''groupTotalMinor'')::bigint);
 end loop;
 for recipient_value in select value from jsonb_array_elements(source_value#>''{projection,recipients}'')loop
  insert into app.native_playoff_final_award_recipients_v1(award_set_id,tournament_id,event_id,participant_id,profile_id,
   tournament_player_id,display_name,first_place,last_place,included,amount_minor)
  values(award_id,tid,eid,(recipient_value->>''participantId'')::uuid,(recipient_value->>''profileId'')::uuid,
   recipient_value->>''tournamentPlayerId'',recipient_value->>''displayName'',(recipient_value->>''firstPlace'')::integer,
   (recipient_value->>''lastPlace'')::integer,(recipient_value->>''included'')::boolean,(recipient_value->>''amountMinor'')::bigint);
 end loop;
 response:=jsonb_build_object(''status'',''accepted'',''code'',''native_playoff_final_awards_recorded_v1'',''awardSetId'',award_id,
  ''version'',1,''sourceDigest'',source_value->>''sourceDigest'',''totalMinor'',(source_value#>>''{projection,totalMinor}'')::bigint,
  ''recipientCount'',jsonb_array_length(source_value#>''{projection,recipients}''),''awardStatus'',''recorded_unpaid'');
 return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'b9724794bd9a80556c6a6dba35b1716528b2b3ee25c41103ecda150c5f74a609' then raise exception 'terminal_writer_preimage_mismatch: app.record_native_unrestricted_income_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare a uuid:=auth.uid();op uuid;expected integer;request_hash text;prior_op app.native_playoff_finance_write_operations_v1%rowtype;
 prior_result jsonb;proposal app.operational_event_finance_revisions_v1%rowtype;recipient jsonb;
 target jsonb;line_value jsonb;requested_record_id uuid;requested_income_id uuid;requested_prior_record uuid;requested_physical_id uuid;
 source_owner app.native_unrestricted_income_sources_v1%rowtype;head app.native_unrestricted_income_records_v1%rowtype;
 record_version integer;record_pk uuid;source_digest text;response jsonb;
begin
 if a is null then return jsonb_build_object(''status'',''rejected'',''code'',''authentication_required'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 if jsonb_typeof(request_value)is distinct from''object''or(select count(*)from jsonb_object_keys(request_value))<>7
  or not(request_value?&array[''kind'',''operationId'',''expectedVersion'',''proposalRevisionId'',''recordId'',''physicalEvidenceId'',''evidenceReference''])
  or request_value->>''kind''is distinct from''native-unrestricted-income-record-v1''
  or coalesce(request_value->>''operationId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or coalesce(request_value->>''proposalRevisionId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or coalesce(request_value->>''recordId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or coalesce(request_value->>''physicalEvidenceId'','''')!~''^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$''
  or jsonb_typeof(request_value->''expectedVersion'')is distinct from''number''
  or(request_value->>''expectedVersion'')!~''^(0|[1-9][0-9]*)$''
  or(request_value->>''expectedVersion'')::numeric>2147483646
  or jsonb_typeof(request_value->''evidenceReference'')is distinct from''string''
  or request_value->>''evidenceReference''<>app.custom_payout_classification_text_v2(request_value->>''evidenceReference'')
  or app.event_settings_js_text_length_v3(request_value->>''evidenceReference'')not between 1 and 2000 then
  return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 op:=(request_value->>''operationId'')::uuid;expected:=(request_value->>''expectedVersion'')::integer;
 requested_record_id:=(request_value->>''recordId'')::uuid;requested_physical_id:=(request_value->>''physicalEvidenceId'')::uuid;
 perform app.assert_closeout_operation_open_v17(a,op);
 if not pg_try_advisory_xact_lock(hashtextextended(a::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable'');end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=a and role in(''director'',''co_director'')order by role for key share nowait;
 if not found then return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');end if;
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_array(''native-playoff-finance-write-v1'',a,tid,eid,op,request_value)::text,''utf8''),''sha256''),''hex'');
 select*into prior_op from app.native_playoff_finance_write_operations_v1 where actor_id=a and operation_id=op;
 if found then
  if prior_op.tournament_id<>tid or prior_op.event_id<>eid or prior_op.request_hash<>request_hash or prior_op.request_payload<>request_value then
   return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;
  select result into prior_result from app.native_playoff_finance_write_outcomes_v1 where actor_id=a and operation_id=op;
  if prior_result is null then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete'');end if;
  return prior_result||jsonb_build_object(''historicalReceipt'',true,''currentSourceVerified'',false);
 end if;
 if app.native_playoff_final_awards_enabled_v1()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if exists(select 1 from app.native_playoff_final_award_sets_v1 where tournament_id=tid and event_id=eid)then
  return jsonb_build_object(''status'',''rejected'',''code'',''final_awards_already_recorded'');end if;
 recipient:=app.get_native_playoff_finance_recipient_source_v1(tid,eid);
 if recipient->>''status''=''retry_exact''then return recipient;end if;
 if recipient->>''status''<>''source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(recipient->>''code'',''source_unavailable''));end if;
 select*into proposal from app.operational_event_finance_revisions_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if not found or proposal.id::text is distinct from request_value->>''proposalRevisionId''
  or proposal.id::text is distinct from recipient#>>''{proposal,revisionId}''then return jsonb_build_object(''status'',''rejected'',''code'',''proposal_source_changed'');end if;
 select value into target from jsonb_array_elements(proposal.editor->''history'')where value#>>''{line,recordId}''=requested_record_id::text;
 if target is null or target#>>''{line,category}''is distinct from''unrestricted_income''
  or target#>>''{line,mode}''is distinct from''estimate''or target#>''{line,source}''is distinct from proposal.editor#>''{basis,source}''then
  return jsonb_build_object(''status'',''rejected'',''code'',''income_record_unavailable'');end if;
 line_value:=target->''line'';requested_income_id:=(line_value->>''lineId'')::uuid;
 requested_prior_record:=case when line_value->''priorRecordId''=''null''::jsonb then null else(line_value->>''priorRecordId'')::uuid end;
 -- Reserve all native source histories before collision checks. This includes
 -- voided/corrected receipt and expense rows across every event in tournament.
 lock table app.roster_payment_events,app.tournament_expense_events in share mode nowait;
 if exists(select 1 from app.roster_payment_events p where p.tournament_id=tid and p.id=requested_physical_id)
  or exists(select 1 from app.tournament_expense_events x where x.tournament_id=tid and x.id=requested_physical_id)then
  return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
 select*into source_owner from app.native_unrestricted_income_sources_v1 s where s.tournament_id=tid and s.income_id=requested_income_id for update;
 if not found then
  if requested_prior_record is not null then return jsonb_build_object(''status'',''rejected'',''code'',''income_lineage_invalid'');end if;
  if exists(select 1 from app.native_unrestricted_income_sources_v1 s where s.tournament_id=tid
    and(s.physical_evidence_id=requested_physical_id or lower(s.evidence_reference)=lower(request_value->>''evidenceReference'')))then
   return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
  -- Insert is delayed until every remaining rejectable preflight below passes.
 else
  if source_owner.event_id<>eid or source_owner.physical_evidence_id<>requested_physical_id
   or lower(source_owner.evidence_reference)<>lower(request_value->>''evidenceReference'')then
   return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
 end if;
 select*into head from app.native_unrestricted_income_records_v1 where tournament_id=tid and event_id=eid order by version desc limit 1;
 if coalesce(head.version,0)<>expected then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;
 if exists(select 1 from app.native_unrestricted_income_records_v1 r where r.tournament_id=tid and r.event_id=eid and r.record_id=requested_record_id)then
  return jsonb_build_object(''status'',''rejected'',''code'',''income_record_conflict'');end if;
 if requested_prior_record is null then
  if exists(select 1 from app.native_unrestricted_income_records_v1 r where r.tournament_id=tid and r.income_id=requested_income_id)then
   return jsonb_build_object(''status'',''rejected'',''code'',''income_lineage_invalid'');end if;
 else
  perform 1 from app.native_unrestricted_income_records_v1 own where own.tournament_id=tid and own.income_id=requested_income_id
   and own.record_id=requested_prior_record and own.record_id=(select r.record_id from app.native_unrestricted_income_records_v1 r
    where r.tournament_id=tid and r.income_id=requested_income_id order by r.version desc limit 1);
  if not found then return jsonb_build_object(''status'',''rejected'',''code'',''income_lineage_invalid'');end if;
 end if;
 if source_owner.income_id is null then
  insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)
   values(tid,eid,requested_income_id,requested_physical_id,request_value->>''evidenceReference'',a);
 end if;
 insert into app.native_playoff_finance_write_operations_v1(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)
  values(a,op,tid,eid,request_value,request_hash);
 source_digest:=encode(extensions.digest(convert_to(jsonb_build_array(''native-unrestricted-income-record-v1'',recipient->>''sourceDigest'',proposal.id,
  target,requested_physical_id,request_value->>''evidenceReference'')::text,''utf8''),''sha256''),''hex'');
 insert into app.native_unrestricted_income_records_v1(tournament_id,event_id,version,income_id,record_id,prior_record_id,
  physical_evidence_id,evidence_reference,proposal_revision_id,amount_minor,voided,label,reason,recorded_by,actor_id,operation_id,source_capture,source_digest)
 values(tid,eid,expected+1,requested_income_id,requested_record_id,requested_prior_record,requested_physical_id,request_value->>''evidenceReference'',proposal.id,
  (line_value->>''amountMinor'')::bigint,(line_value->>''voided'')::boolean,target->>''label'',line_value->>''reason'',a,a,op,
  jsonb_build_object(''recipientSourceDigest'',recipient->>''sourceDigest'',''proposalRevisionId'',proposal.id,''proposalLine'',target),source_digest)
 returning id,version into record_pk,record_version;
 response:=jsonb_build_object(''status'',''accepted'',''code'',''native_unrestricted_income_recorded_v1'',''incomeRecordId'',record_pk,
  ''incomeId'',requested_income_id,''version'',record_version,''proposalRevisionId'',proposal.id,''recordedBookkeepingOnly'',true,
  ''bankReceiptVerified'',false,''coverageGuarantee'',''all_native_receipt_expense_history_reserved'');
 return app.finish_native_playoff_finance_write_v1(a,tid,eid,op,response);
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'623f6f4a473dc2e2bc494e435c7c0cad69e0e8c8637b9dbe3e98d8ac3dedf555' then raise exception 'terminal_writer_preimage_mismatch: app.record_native_optional_income_v2';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare prior app.native_optional_income_operations_v2%rowtype;root app.native_unrestricted_income_sources_v1%rowtype;context_value jsonb;target jsonb;line_value jsonb;
 h text;result_value jsonb;income_id_value uuid;record_id_value uuid;prior_id_value uuid;physical_id_value uuid;latest_id uuid;capture_value jsonb;digest text;rid uuid:=extensions.gen_random_uuid();
begin
 if coalesce(nullif(current_setting(''request.jwt.claim.role'',true),''''),(nullif(current_setting(''request.jwt.claims'',true),'''')::jsonb)->>''role'','''')<>''service_role''or actor is null or op is null then return null;end if;
 if app.native_optional_income_enabled_v2()is distinct from true then return jsonb_build_object(''status'',''rejected'',''code'',''feature_unavailable'');end if;
 if current_setting(''transaction_isolation'')<>''read committed''then return jsonb_build_object(''status'',''retry_exact'',''code'',''isolation_not_supported'');end if;
 perform app.assert_closeout_operation_open_v17(actor,op);
 if not pg_try_advisory_xact_lock(hashtextextended(actor::text||'':''||op::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''event-lifecycle:''||eid::text,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''event_busy'');end if;
 perform 1 from app.tournaments where id=tid for update nowait;if not found then return null;end if;
 perform 1 from app.tournament_roles where tournament_id=tid and profile_id=actor and role=''director''for key share nowait;if not found then return null;end if;
 if jsonb_typeof(request)is distinct from''object''or(select count(*)from jsonb_object_keys(request))<>7 or not(request?&array[''kind'',''expectedVersion'',''proposalRevisionId'',''ownershipRevisionId'',''recordId'',''physicalEvidenceId'',''evidenceReference''])
  or request->>''kind''is distinct from''native-optional-income-record-v2''or jsonb_typeof(request->''expectedVersion'')is distinct from''number''or coalesce(request->>''expectedVersion'','''')!~''^(0|[1-9][0-9]{0,9})$''or(request->>''expectedVersion'')::numeric>=2147483647
  or coalesce(request->>''proposalRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''ownershipRevisionId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or coalesce(request->>''recordId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''or coalesce(request->>''physicalEvidenceId'','''')!~''^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$''
  or jsonb_typeof(request->''evidenceReference'')is distinct from''string''or request->>''evidenceReference''is distinct from app.custom_payout_classification_text_v2(request->>''evidenceReference'')or app.event_settings_js_text_length_v3(request->>''evidenceReference'')not between 1 and 2000
 then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_array(''native-optional-income-v2'',actor,op,tid,eid,request)::text,''utf8''),''sha256''),''hex'');
 select*into prior from app.native_optional_income_operations_v2 where actor_id=actor and operation_id=op;
 if found then
  if prior.tournament_id is distinct from tid or prior.event_id is distinct from eid or prior.request_payload is distinct from request or prior.request_hash is distinct from h then return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');end if;
  select result into result_value from app.native_optional_income_outcomes_v2 where actor_id=actor and operation_id=op;return coalesce(result_value,jsonb_build_object(''status'',''retry_exact'',''code'',''operation_incomplete''));
 end if;
 context_value:=app.native_optional_income_context_v2(actor,tid,eid,true);
 if context_value->>''status''=''retry_exact''then return context_value;end if;
 if context_value is null or context_value->>''status''is distinct from''income_source_available''then return jsonb_build_object(''status'',''rejected'',''code'',coalesce(context_value->>''code'',''income_source_unavailable''));end if;
 if context_value->>''proposalRevisionId''is distinct from request->>''proposalRevisionId''or context_value->>''ownershipRevisionId''is distinct from request->>''ownershipRevisionId''then return jsonb_build_object(''status'',''rejected'',''code'',''proposal_source_changed'');end if;
 if(context_value->>''headVersion'')::integer<>(request->>''expectedVersion'')::integer then return jsonb_build_object(''status'',''rejected'',''code'',''stale_version'');end if;
 target:=context_value->''nextUnposted'';line_value:=target->''line'';
 if target is null or target=''null''::jsonb or line_value->>''recordId''is distinct from request->>''recordId''then return jsonb_build_object(''status'',''rejected'',''code'',''income_record_unavailable'');end if;
 income_id_value:=(line_value->>''lineId'')::uuid;record_id_value:=(line_value->>''recordId'')::uuid;physical_id_value:=(request->>''physicalEvidenceId'')::uuid;
 prior_id_value:=case when line_value->''priorRecordId''=''null''::jsonb then null else(line_value->>''priorRecordId'')::uuid end;
 if exists(select 1 from app.roster_payment_events where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.tournament_expense_events where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.event_side_pool_election_versions where tournament_id=tid and id=physical_id_value)
  or exists(select 1 from app.event_side_pool_team_election_versions where tournament_id=tid and id=physical_id_value)
 then return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
 if exists(select 1 from app.native_unrestricted_income_records_v1 where tournament_id=tid and income_id=income_id_value)then return jsonb_build_object(''status'',''rejected'',''code'',''income_journal_domain_conflict'');end if;
 select*into root from app.native_unrestricted_income_sources_v1 where tournament_id=tid and income_id=income_id_value;
 if root.income_id is not null and(root.event_id<>eid or root.physical_evidence_id<>physical_id_value or root.evidence_reference is distinct from request->>''evidenceReference'')then return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
 if root.income_id is null and exists(select 1 from app.native_unrestricted_income_sources_v1 where tournament_id=tid and(physical_evidence_id=physical_id_value or lower(evidence_reference)=lower(request->>''evidenceReference'')))then return jsonb_build_object(''status'',''rejected'',''code'',''physical_evidence_conflict'');end if;
 select record_id into latest_id from app.native_optional_income_records_v2 where tournament_id=tid and income_id=income_id_value order by version desc limit 1;
 if prior_id_value is distinct from latest_id or(root.income_id is null and prior_id_value is not null)then return jsonb_build_object(''status'',''rejected'',''code'',''income_lineage_invalid'');end if;
 if exists(select 1 from app.native_optional_income_records_v2 where tournament_id=tid and record_id=record_id_value)then return jsonb_build_object(''status'',''rejected'',''code'',''income_record_conflict'');end if;
 capture_value:=jsonb_build_object(''kind'',''native-optional-income-record-source-v2'',''context'',context_value,''proposalLine'',target,''physicalEvidenceId'',physical_id_value,''evidenceReference'',request->''evidenceReference'');
 if octet_length(capture_value::text)>4200000 then return jsonb_build_object(''status'',''rejected'',''code'',''technical_resource_bound'');end if;
 digest:=encode(extensions.digest(convert_to(capture_value::text,''utf8''),''sha256''),''hex'');
 if root.income_id is null then insert into app.native_unrestricted_income_sources_v1(tournament_id,event_id,income_id,physical_evidence_id,evidence_reference,created_by)values(tid,eid,income_id_value,physical_id_value,request->>''evidenceReference'',actor);end if;
 insert into app.native_optional_income_operations_v2(actor_id,operation_id,tournament_id,event_id,request_payload,request_hash)values(actor,op,tid,eid,request,h);
 insert into app.native_optional_income_records_v2(id,tournament_id,event_id,version,income_id,record_id,prior_record_id,physical_evidence_id,evidence_reference,proposal_revision_id,ownership_revision_id,amount_minor,voided,label,reason,actor_id,operation_id,source_capture,source_digest)
 values(rid,tid,eid,(request->>''expectedVersion'')::integer+1,income_id_value,record_id_value,prior_id_value,physical_id_value,request->>''evidenceReference'',(request->>''proposalRevisionId'')::uuid,(request->>''ownershipRevisionId'')::uuid,
  (line_value->>''amountMinor'')::bigint,(line_value->>''voided'')::boolean,target->>''label'',line_value->>''reason'',actor,op,capture_value,digest);
 result_value:=jsonb_build_object(''status'',''optional_income_recorded_v2'',''actorId'',actor,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''incomeRecordId'',rid,''incomeId'',income_id_value,''recordId'',record_id_value,''version'',(request->>''expectedVersion'')::integer+1,
  ''proposalRevisionId'',request->''proposalRevisionId'',''ownershipRevisionId'',request->''ownershipRevisionId'',''recordedBookkeepingOnly'',true,''bankReceiptVerified'',false,''moneyMoved'',false,''payoutAuthorized'',false,''disbursementAuthorized'',false,''finalizationAuthorized'',false);
 insert into app.native_optional_income_outcomes_v2(actor_id,operation_id,tournament_id,event_id,result)values(actor,op,tid,eid,result_value);return result_value;
exception when lock_not_available then return jsonb_build_object(''status'',''retry_exact'',''code'',''source_busy'');
 when unique_violation then return jsonb_build_object(''status'',''rejected'',''code'',''income_identity_conflict'');
 when invalid_text_representation or numeric_value_out_of_range then return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $patch$ declare target regprocedure:='public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)'::regprocedure; old text; definition text; acl aclitem[]; owner_id oid; config text[]; begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and proowner='postgres'::regrole and prosecdef;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'78ea461c175698e888c1b3fad14ecea03feb89cceff082a02671e9218a3bd60f' then raise exception 'terminal_writer_preimage_mismatch: public.reopen_event_play_v1';end if;
 definition:=pg_get_functiondef(target);
 if position(old in replace(definition,E'\r\n',E'\n'))=0 then raise exception 'terminal_definition_body_mismatch';end if;
 execute replace(replace(definition,E'\r\n',E'\n'),old,'
declare
  v_reason text := trim(coalesce(p_reason, ''''));
  v_hash text; v_existing app.operation_receipts%rowtype; v_receipt uuid;
  v_readiness jsonb; v_response jsonb;
begin
  if coalesce((select auth.jwt()->>''role''), '''') <> ''service_role'' then
    raise exception using errcode=''P0001'', message=''server-only reopen event'';
  end if;
  if p_actor_id is null or p_tournament_id is null or p_event_id is null or p_operation_id is null
     or length(v_reason) not between 1 and 1000 then
    return jsonb_build_object(''status'',''rejected'',''code'',''invalid_request'');
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_array(
    ''reopen_event_play_v1'', p_actor_id::text, p_tournament_id::text, p_event_id::text,
    v_reason, p_operation_id::text)::text,''utf8''),''sha256''),''hex'');
 perform app.assert_closeout_operation_open_v17(p_actor_id,p_operation_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor_id::text||'':''||p_operation_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''event-play-gate:''||p_event_id::text,0));

  select * into v_existing from app.operation_receipts
    where actor_profile_id=p_actor_id and client_operation_id=p_operation_id for update;
  if found then
    if v_existing.operation_type=''reopen_event_play_v1'' and v_existing.request_hash=v_hash then
      return v_existing.response_payload;
    end if;
    return jsonb_build_object(''status'',''rejected'',''code'',''idempotency_conflict'');
  end if;

  perform 1 from app.tournaments tournament
    where tournament.id=p_tournament_id and tournament.status=''open'' for update;
  if not found then return jsonb_build_object(''status'',''rejected'',''code'',''tournament_unavailable''); end if;
  if not exists(select 1 from app.tournament_roles role_row where role_row.tournament_id=p_tournament_id
      and role_row.profile_id=p_actor_id and role_row.role in(''director'',''co_director'')) then
    return jsonb_build_object(''status'',''rejected'',''code'',''not_director'');
  end if;
  if not exists(select 1 from app.events event_row
      where event_row.id=p_event_id and event_row.tournament_id=p_tournament_id) then
    return jsonb_build_object(''status'',''rejected'',''code'',''event_unavailable'');
  end if;
  if app.event_play_close_state_v1(p_event_id)<>''closed'' then
    return jsonb_build_object(''status'',''not_closed'',''eventId'',p_event_id);
  end if;
  if not app.event_play_reopen_is_safe_v1(p_event_id) then
    return jsonb_build_object(''status'',''rejected'',''code'',''downstream_activity'');
  end if;

  v_readiness := app.event_play_close_readiness_v1(p_event_id);
  v_response := jsonb_build_object(''status'',''event_play_reopened'',''eventId'',p_event_id,''closeState'',''open'');

  insert into app.operation_receipts(tournament_id,actor_profile_id,operation_type,target_id,
    request_hash,client_operation_id,outcome,response_payload,applied_at)
  values(p_tournament_id,p_actor_id,''reopen_event_play_v1'',p_event_id,
    v_hash,p_operation_id,''accepted'',v_response,clock_timestamp())
  returning id into v_receipt;

  insert into app.event_play_closes(tournament_id,event_id,action,reason,scheduled_game_count,
    resolved_game_count,actor_profile_id,operation_receipt_id)
  values(p_tournament_id,p_event_id,''reopened'',v_reason,
    (v_readiness->>''scheduledGames'')::integer,(v_readiness->>''resolvedGames'')::integer,p_actor_id,v_receipt);

  insert into app.audit_events(tournament_id,actor_profile_id,operation_receipt_id,entity_type,
    entity_id,action,before_state,after_state)
  values(p_tournament_id,p_actor_id,v_receipt,''event_play_close'',p_event_id,''event_play_reopened'',
    jsonb_build_object(''closeState'',''closed''), v_response || jsonb_build_object(''reason'',v_reason));

  return v_response;
end;
');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef)) then raise exception 'terminal_writer_security_changed';end if;
end $patch$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='1ffe7feea77eaec86969b033841e80c53522793224b8e322cdc4d90661ddc304')then raise exception 'terminal_delegate_preimage_mismatch: public.record_manual_pool_final_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='61de5de85d0faa9deb51332dc2d058de9fd00cbbb35a2237cd9be1f465287616')then raise exception 'terminal_delegate_preimage_mismatch: public.record_modern_event_final_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='a78aa0f7995c107348b9bfc7fd9c078ac4866adc3386edd6894d53350febbfa0')then raise exception 'terminal_delegate_preimage_mismatch: public.record_modern_event_closure_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='96d1bfaa18d0bf448288f3ee77d4353a4d13839b62a5a49f1dd2a798455724ce')then raise exception 'terminal_delegate_preimage_mismatch: public.record_regular_consolation_final_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='b4e86ef746602679072975827cc4a71f8454cdd2bba84620d0ba0fd438dcade8')then raise exception 'terminal_delegate_preimage_mismatch: public.record_regular_consolation_closure_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='f4296e6904a8b71ee56f0d5f8cbdcbf2199cfcf4deab909a18edaffc4b2698be')then raise exception 'terminal_delegate_preimage_mismatch: public.record_selected_step_pool_provider_v3';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='ef44a346b00cdd239876bd8266081abfd25ee4bf93e8e8ccc0c463cd92b5114e')then raise exception 'terminal_delegate_preimage_mismatch: public.record_selected_step_awards_provider_v3';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='843fcd09c0006f3e33f543bb2c1c1126632f6027e22886530010db8d51a76b9e')then raise exception 'terminal_delegate_preimage_mismatch: app.selected_step_award_dispatch_write_v3';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='c4f356c583a76d9a881c1dd60f20e5ae0f4489a01fd58733263a309d99e6a768')then raise exception 'terminal_delegate_preimage_mismatch: public.record_modern_prize_awards_provider_v2';end if;end $delegate$;
do $delegate$begin if to_regprocedure('public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)')is not null and not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='183025fe950f268dcf014b0efe1b978fbad4a738244d5c5a2f889dd61b6a0d58')then raise exception 'terminal_delegate_preimage_mismatch: public.record_native_playoff_final_awards_provider_v1';end if;end $delegate$;
do $delegate$begin if to_regprocedure('public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)')is not null and not exists(select 1 from pg_proc where oid=to_regprocedure('public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='827ababf90a00d5bc56b1c7902a1daadb7d0e8a80dec7731cc3a269148b17197')then raise exception 'terminal_delegate_preimage_mismatch: public.record_native_unrestricted_income_provider_v1';end if;end $delegate$;
do $delegate$begin if not exists(select 1 from pg_proc where oid=to_regprocedure('public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)')and proowner='postgres'::regrole and prosecdef and encode(extensions.digest(convert_to(replace(prosrc,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')='23b7daa2ac39d7f8e468bed2ae1959d4aaa86188a40e483294f2ce7a26422588')then raise exception 'terminal_delegate_preimage_mismatch: public.close_synthetic_event_v1';end if;end $delegate$;

-- CLOSED LOCAL PROPOSAL. No execute grants, no activation or hosted apply.
-- Apply only atomically after reviewed terminal core + ALL pinned admissions.
create function public.get_closeout_terminal_v18(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_terminal_recovery';end if;
 return app.get_closeout_terminal_v17(actor,sid,tid,eid,op,stage,request);
end$$;
create function public.retire_closeout_operation_v18(actor uuid,sid uuid,tid uuid,eid uuid,op uuid,stage text,request jsonb,reason text)returns jsonb language plpgsql security definer set search_path=''as $$begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_terminal_retirement';end if;
 return app.retire_closeout_operation_v17(actor,sid,tid,eid,op,stage,request,reason);
end$$;
alter function public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)owner to postgres;
alter function public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)owner to postgres;
revoke all on function public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb),public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)from public,anon,authenticated,service_role;
do $post$begin if app.closeout_retirement_enabled_v17()is distinct from false then raise exception 'terminal_retirement_must_stay_closed';end if;if exists(select 1 from pg_roles r cross join(values('public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)'),('public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)'))v(signature)where r.rolname in('anon','authenticated','service_role')and has_function_privilege(r.oid,to_regprocedure(v.signature),'EXECUTE'))then raise exception 'terminal_rpc_must_remain_closed';end if;end $post$;

-- LOCAL PROTOCOL PROPOSAL, NOT AN INSTALLER. No grants or activation.
-- bootstrap_fenced MUST stay false until all pinned first-effect tables and
-- old-running-body fencing have been installed atomically. This file does NOT
-- establish that boundary. Never change this marker merely to enable a UI.
create table app.closeout_write_control_v19(
 singleton boolean primary key default true check(singleton),
 version bigint not null default 0 check(version>=0),
 paused boolean not null default true,
 drained_version bigint not null default 0 check(drained_version>=0 and drained_version<=version),
 bootstrap_fenced boolean not null default false,
 check(not paused or drained_version=version));
insert into app.closeout_write_control_v19(singleton)values(true);
alter table app.closeout_write_control_v19 enable row level security;
alter table app.closeout_write_control_v19 force row level security;
revoke all on app.closeout_write_control_v19 from public,anon,authenticated,service_role;
create table app.closeout_write_control_audit_v19(
 operation_id uuid primary key,request jsonb not null,result jsonb not null,
 database_actor name not null default current_user,
 database_session_actor name not null default session_user,
 created_at timestamptz not null default clock_timestamp());
alter table app.closeout_write_control_audit_v19 enable row level security;
alter table app.closeout_write_control_audit_v19 force row level security;
revoke all on app.closeout_write_control_audit_v19 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_write_control_audit_v19 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_write_control_audit_v19 for each statement execute function app.reject_immutable_history();

-- Participating writers hold the row SHARE lock until transaction completion.
-- An operator FOR UPDATE lock waits for those writers; NOWAIT admission rejects
-- newcomers while a pause owns the row. Terminal reads need no such lock.
create function app.require_closeout_write_admission_v19()returns void
language plpgsql security definer set search_path='' as $$
declare c app.closeout_write_control_v19%rowtype;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'closeout_isolation_unsupported';end if;
 select * into strict c from app.closeout_write_control_v19 where singleton for share nowait;
 if not c.bootstrap_fenced or c.paused then raise exception using errcode='PZ019',message='closeout_writes_paused';end if;
end$$;
revoke all on function app.require_closeout_write_admission_v19()from public,anon,authenticated,service_role;

-- Direct DB operator only; deliberately SECURITY INVOKER. No HTTP entrypoint.
-- Returned result is transaction-local. Confirm COMMIT using a fresh control
-- read; exact historical replay alone is NOT proof of the current drain state.
create function app.set_closeout_write_pause_v19(op uuid,expected_version bigint,
 desired_pause boolean,reason text,authorization_ref text)returns jsonb
language plpgsql set search_path='' as $$
declare c app.closeout_write_control_v19%rowtype; prior app.closeout_write_control_audit_v19%rowtype;
 req jsonb;reply jsonb;
begin
 if current_user<>'postgres'or session_user<>'postgres' or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'closeout_operator_required';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception 'closeout_isolation_unsupported';end if;
 if op is null or expected_version is null or expected_version<0 or desired_pause is null or reason is null or btrim(reason)=''or length(reason)>1000 or authorization_ref is null or btrim(authorization_ref)=''or length(authorization_ref)>1000 then raise exception 'invalid_closeout_control_request';end if;
 req:=jsonb_build_object('expectedVersion',expected_version,'paused',desired_pause,'reason',reason,'authorizationRef',authorization_ref);
 -- Caller must set a bounded transaction lock_timeout before invoking. Never
 -- claim drained on timeout; transaction rollback leaves control/audit intact.
 if current_setting('lock_timeout')::interval<=interval '0'or current_setting('lock_timeout')::interval>interval '5 seconds'then raise exception 'bounded_lock_timeout_required';end if;
 select * into strict c from app.closeout_write_control_v19 where singleton for update;
 select * into prior from app.closeout_write_control_audit_v19 where operation_id=op;
 if found then if prior.request is distinct from req then raise exception 'closeout_control_operation_conflict';end if;return prior.result;end if;
 if c.version<>expected_version then raise exception 'closeout_control_stale_version';end if;
 if not desired_pause and not c.bootstrap_fenced then raise exception 'closeout_bootstrap_unverified';end if;
 update app.closeout_write_control_v19 set version=version+1,paused=desired_pause,
 drained_version=case when desired_pause then version+1 else drained_version end where singleton returning * into c;
 reply:=jsonb_build_object('kind','closeout-control-v19','version',c.version,'paused',c.paused,'drainedVersion',c.drained_version,'bootstrapFenced',c.bootstrap_fenced,'commitRequired',true);
 insert into app.closeout_write_control_audit_v19(operation_id,request,result)values(op,req,reply);
 return reply;
end$$;
revoke all on function app.set_closeout_write_pause_v19(uuid,bigint,boolean,text,text)from public,anon,authenticated,service_role;

-- LOCAL V20 INCREMENTAL PROPOSAL. Requires exact V18 + V19, no grants.
-- NOT HOSTED CLEARANCE. bootstrap_fenced remains false. No activation here.
do $$begin if current_user<>'postgres' or session_user<>'postgres' or exists(select 1 from pg_roles where rolname=current_user and(rolsuper or not rolbypassrls))then raise exception 'closeout_installer_role_mismatch';end if;end$$;
lock table app.closeout_terminal_retirements_v17 in share row exclusive mode nowait;
lock table app.manual_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.manual_pool_final_authorizations_v1 in share row exclusive mode nowait;
lock table app.modern_event_closures_v1 in share row exclusive mode nowait;
lock table app.modern_event_final_operations_v1 in share row exclusive mode nowait;
lock table app.modern_prize_award_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_final_operations_v2 in share row exclusive mode nowait;
lock table app.native_optional_income_operations_v2 in share row exclusive mode nowait;
lock table app.native_playoff_finance_write_operations_v1 in share row exclusive mode nowait;
lock table app.native_unrestricted_income_sources_v1 in share row exclusive mode nowait;
lock table app.operation_receipts in share row exclusive mode nowait;
lock table app.regular_consolation_closures_v1 in share row exclusive mode nowait;
lock table app.regular_consolation_final_operations_v1 in share row exclusive mode nowait;
lock table app.selected_step_award_operations_v3 in share row exclusive mode nowait;
lock table app.selected_step_pool_operations_v3 in share row exclusive mode nowait;
do $patch$declare target regprocedure:='app.assert_closeout_operation_open_v17(uuid,uuid)'::regprocedure; old text;definition text;acl aclitem[];owner_id oid;config text[];begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'3cf011c2dcb20901aa8c9d67de27077dcc8a8000f419f4c64c6efb9202de8bae'then raise exception 'closeout_v20_preimage_mismatch';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if position(old in definition)=0 then raise exception 'closeout_v20_definition_mismatch';end if;
 execute replace(definition,old,'begin
 perform app.require_closeout_write_admission_v19();
 if actor is null or op is null then raise exception ''terminal_operation_identity_required'';end if;
 if current_setting(''transaction_isolation'')<>''read committed''then raise exception ''terminal_isolation_unsupported'';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''closeout-terminal-v17:''||actor||'':''||op,0))then raise exception using errcode=''55P03'',message=''terminal_operation_busy'';end if;
 -- Enforcement is deliberately independent of the NEW retirement feature gate.
 if exists(select 1 from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op)then raise exception using errcode=''PZ017'',message=''closeout_operation_retired'';end if;
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef))then raise exception 'closeout_v20_security_changed';end if;
 end$patch$;
do $patch$declare target regprocedure:='app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)'::regprocedure; old text;definition text;acl aclitem[];owner_id oid;config text[];begin
 select replace(prosrc,E'\r\n',E'\n'),proacl,proowner,proconfig into old,acl,owner_id,config from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(old,'utf8'),'sha256'),'hex')<>'190d2df44e96e942dbece3b8d650360714c4ac7416964c988321e77676e267c3'then raise exception 'closeout_v20_preimage_mismatch';end if;
 definition:=replace(pg_get_functiondef(target),E'\r\n',E'\n');if position(old in definition)=0 then raise exception 'closeout_v20_definition_mismatch';end if;
 execute replace(definition,old,'
declare prior app.closeout_terminal_retirements_v17%rowtype;r jsonb;lookup text;journal text;present boolean;
begin
 perform app.require_closeout_write_admission_v19();
 if app.closeout_retirement_enabled_v17()is distinct from true or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 if actor is null or sid is null or tid is null or eid is null or op is null or stage is null or stage not in(''pool'',''event'',''closure'',''regular'',''regular-closure'')or jsonb_typeof(request)is distinct from''object''or octet_length(request::text)>150000 or reason is null or length(trim(reason))not between 1 and 1000 then raise exception ''invalid_terminal_request'';end if;
 if request->>''kind''is distinct from(case stage when''pool''then''manual-pool-finalize-v1''when''event''then''modern-event-finalize-v1''when''closure''then''modern-event-close-v1''when''regular''then''regular-consolation-finalize-v1''else''regular-consolation-close-v1''end)then raise exception ''terminal_stage_request_mismatch'';end if;
 if current_setting(''transaction_isolation'')<>''read committed''then raise exception ''terminal_isolation_unsupported'';end if;
 -- Session lock privilege must be independently established; no auth grants here.
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then raise exception ''terminal_session_denied'';end if;
 if not pg_try_advisory_xact_lock(hashtextextended(''closeout-terminal-v17:''||actor||'':''||op,0))then return jsonb_build_object(''status'',''retry_exact'',''code'',''operation_busy'');end if;
 select * into prior from app.closeout_terminal_retirements_v17 where actor_id=actor and operation_id=op;
 if found then if prior.tournament_id=tid and prior.event_id=eid and prior.stage=stage and prior.request=request and prior.reason=reason then return prior.result;end if;return jsonb_build_object(''status'',''rejected'',''code'',''operation_conflict'');end if;
 lookup:=case stage when''pool''then''get_manual_pool_final_operation_v1''when''event''then''get_modern_event_final_operation_v1''when''closure''then''get_modern_event_closure_operation_v1''when''regular''then''get_regular_consolation_final_operation_v1''else''get_regular_consolation_closure_operation_v1''end;
 execute format(''select public.%I($1,$2,$3,$4,$5,$6)'',lookup)into r using actor,sid,tid,eid,op,request;
 if r->>''status''is distinct from''unknown''or r->>''code''is distinct from''operation_not_found''then return r;end if;
 -- Any other/incomplete known journal is ambiguous, never declared no effect.
 foreach journal in array array[''manual_pool_final_authorizations_v1'',''modern_event_final_operations_v1'',''regular_consolation_final_operations_v1'',''modern_event_closures_v1'',''regular_consolation_closures_v1'',''selected_step_pool_operations_v3'',''selected_step_award_operations_v3'',''modern_prize_award_operations_v2'',''manual_final_authorizations_v1'',''native_optional_final_operations_v2'',''native_playoff_finance_write_operations_v1'',''native_optional_income_operations_v2'']loop
  execute format(''select exists(select 1 from app.%I where actor_id=$1 and operation_id=$2)'',journal)into present using actor,op;if present then return jsonb_build_object(''status'',''unknown'',''code'',''legacy_operation_history_requires_review'');end if;
 end loop;
 if exists(select 1 from app.operation_receipts where actor_profile_id=actor and client_operation_id=op)then return jsonb_build_object(''status'',''unknown'',''code'',''legacy_operation_history_requires_review'');end if;
 if app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then raise exception ''terminal_authorization_changed'';end if;
 r:=jsonb_build_object(''kind'',''closeout-terminal-retirement-v17'',''status'',''retired_no_effect'',''actorId'',actor,''sessionId'',sid,''tournamentId'',tid,''eventId'',eid,''operationId'',op,''stage'',stage,''request'',request,''reason'',reason,''moneyMoved'',false,''payoutAuthorized'',false,''officialMrpAwarded'',false,''accSubmissionPerformed'',false);
 insert into app.closeout_terminal_retirements_v17(actor_id,operation_id,session_id,tournament_id,event_id,stage,request,result,reason)values(actor,op,sid,tid,eid,stage,request,r,reason);
 return r;
end');
 if exists(select 1 from pg_proc where oid=target and(proacl is distinct from acl or proowner<>owner_id or proconfig is distinct from config or not prosecdef))then raise exception 'closeout_v20_security_changed';end if;
 end$patch$;

create function app.closeout_first_effect_fence_v20()returns trigger language plpgsql security definer set search_path=''as $$
declare actor uuid;op uuid;
begin
 -- Generic operation receipts serve many unrelated workflows: preserve them.
 if tg_table_name='operation_receipts' then
  if new.operation_type is null then raise exception 'closeout_receipt_kind_required';end if;
  if new.operation_type not in('close_event_play_v1','reopen_event_play_v1')then return new;end if;
  actor:=new.actor_profile_id;op:=new.client_operation_id;
 elsif tg_table_name='native_playoff_finance_write_operations_v1'then
  if new.request_payload->>'kind'='native-recorded-fund-review-v1'then return new;end if;
  if coalesce(new.request_payload->>'kind','')not in('native-playoff-final-awards-v1','native-unrestricted-income-record-v1')then raise exception 'closeout_journal_kind_unreviewed';end if;
  actor:=new.actor_id;op:=new.operation_id;
 elsif tg_table_name='native_unrestricted_income_sources_v1'then
  -- Both native income writers touch this shared source before their journal.
  -- No operation exists on this row: admission here, tombstone at next journal.
  perform app.require_closeout_write_admission_v19();return new;
 else actor:=new.actor_id;op:=new.operation_id;
 end if;
 if actor is null or op is null then raise exception 'closeout_fence_identity_required';end if;
 perform app.assert_closeout_operation_open_v17(actor,op);return new;
end$$;
revoke all on function app.closeout_first_effect_fence_v20()from public,anon,authenticated,service_role;
create trigger closeout_first_effect_v20 before insert on app.closeout_terminal_retirements_v17 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.manual_final_authorizations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.manual_pool_final_authorizations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_event_closures_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_event_final_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.modern_prize_award_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_optional_final_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_optional_income_operations_v2 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_playoff_finance_write_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.native_unrestricted_income_sources_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.operation_receipts for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.regular_consolation_closures_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.regular_consolation_final_operations_v1 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.selected_step_award_operations_v3 for each row execute function app.closeout_first_effect_fence_v20();
create trigger closeout_first_effect_v20 before insert on app.selected_step_pool_operations_v3 for each row execute function app.closeout_first_effect_fence_v20();

-- LOCAL CLOSED PROPOSAL. Apply after exact reviewed V18 + V19 + V20 fence,
-- within the SAME transaction as their preflight. No client execute grants.
create table app.closeout_runtime_pins_v20(
 singleton boolean primary key check(singleton),
 signatures text[] not null,tables text[] not null,
 expected_catalog_hash text not null check(expected_catalog_hash~'^[a-f0-9]{64}$'),
 admission_set_hash text not null check(admission_set_hash~'^[a-f0-9]{64}$'));
alter table app.closeout_runtime_pins_v20 enable row level security;
alter table app.closeout_runtime_pins_v20 force row level security;
revoke all on app.closeout_runtime_pins_v20 from public,anon,authenticated,service_role;
create trigger immutable before update or delete on app.closeout_runtime_pins_v20 for each row execute function app.reject_immutable_history();
create trigger no_truncate before truncate on app.closeout_runtime_pins_v20 for each statement execute function app.reject_immutable_history();

-- Hash canonical code/security metadata, never the stored expected hash or
-- changing control values. Missing signatures/relations produce NULL entries,
-- hence cannot compare equal to the originally complete installation snapshot.
create function app.closeout_catalog_hash_v20(signatures text[],tables text[])returns text
language sql stable security definer set search_path=''as $$
 select encode(extensions.digest(convert_to(jsonb_build_array(
  (select jsonb_agg(jsonb_build_array(s,p.proowner::regrole::text,p.prosecdef,p.provolatile,p.proconfig,
   coalesce((select jsonb_agg(a::text order by a::text collate "C")from unnest(p.proacl)a),'null'::jsonb),
   replace(pg_get_functiondef(p.oid),E'\r\n',E'\n'))order by s collate "C")from unnest(signatures)s left join pg_proc p on p.oid=to_regprocedure(s)),
  (select jsonb_agg(jsonb_build_array(t,c.relowner::regrole::text,c.relrowsecurity,c.relforcerowsecurity,
   coalesce((select jsonb_agg(a::text order by a::text collate "C")from unnest(c.relacl)a),'null'::jsonb),
   (select jsonb_agg(jsonb_build_array(tr.tgname,tr.tgenabled,pg_get_triggerdef(tr.oid),
    replace(pg_get_functiondef(tr.tgfoid),E'\r\n',E'\n'),fp.proowner::regrole::text,fp.proconfig,
    (select jsonb_agg(a::text order by a::text collate "C")from unnest(fp.proacl)a))order by tr.tgname collate "C")from pg_trigger tr join pg_proc fp on fp.oid=tr.tgfoid where tr.tgrelid=c.oid and not tr.tgisinternal),
   (select jsonb_agg(jsonb_build_array(att.attname,att.atttypid::regtype::text,att.attnotnull,att.attidentity,att.attgenerated,
    pg_get_expr(d.adbin,d.adrelid),(select jsonb_agg(a::text order by a::text collate "C")from unnest(att.attacl)a))order by att.attnum)from pg_attribute att left join pg_attrdef d on d.adrelid=att.attrelid and d.adnum=att.attnum where att.attrelid=c.oid and att.attnum>0 and not att.attisdropped),
   (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid),convalidated,condeferrable,condeferred)order by conname collate "C")from pg_constraint where conrelid=c.oid),
   (select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,
    (select jsonb_agg(r::regrole::text order by r::regrole::text collate "C")from unnest(polroles)r),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid))order by polname collate "C")from pg_policy where polrelid=c.oid))order by t collate "C")from unnest(tables)t left join pg_class c on c.oid=to_regclass(t)),
  (select jsonb_agg(jsonb_build_array(nspname,nspowner::regrole::text,(select jsonb_agg(a::text order by a::text collate "C")from unnest(nspacl)a))order by nspname collate "C")from pg_namespace where nspname in('app','auth','public','extensions')),
  (select jsonb_agg(jsonb_build_array(rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolbypassrls,rolvaliduntil)order by rolname collate "C")from pg_roles where rolname in('postgres','anon','authenticated','service_role')),
  (select jsonb_agg(jsonb_build_array(roleid::regrole::text,member::regrole::text,grantor::regrole::text,admin_option,inherit_option,set_option)order by roleid::regrole::text collate "C",member::regrole::text collate "C",grantor::regrole::text collate "C")from pg_auth_members where roleid in(select oid from pg_roles where rolname in('postgres','anon','authenticated','service_role'))or member in(select oid from pg_roles where rolname in('postgres','anon','authenticated','service_role'))),
  (select jsonb_agg(jsonb_build_array(extname,extversion,extowner::regrole::text,extnamespace::regnamespace::text)order by extname collate "C")from pg_extension where extname='pgcrypto'))::text,'utf8'),'sha256'),'hex')
$$;
revoke all on function app.closeout_catalog_hash_v20(text[],text[])from public,anon,authenticated,service_role;
create function app.closeout_catalog_verified_v20()returns boolean language sql stable security definer set search_path=''as $$
 select coalesce((select expected_catalog_hash=app.closeout_catalog_hash_v20(signatures,tables)from app.closeout_runtime_pins_v20 where singleton),false)
$$;
revoke all on function app.closeout_catalog_verified_v20()from public,anon,authenticated,service_role;

-- Replace only the previously exact V19 admission body, preserving OID/ACL.
do $pin$declare target regprocedure:='app.require_closeout_write_admission_v19()'::regprocedure;old text;definition text;begin
 select prosrc into old from pg_proc where oid=target and prosecdef and proowner='postgres'::regrole;
 if old is null or encode(extensions.digest(convert_to(replace(old,E'\r\n',E'\n'),'utf8'),'sha256'),'hex')<>'484af50d38396ee01d691e3a640b9c4ef13ff848133df91142ef900835232d65'then raise exception 'closeout_admission_preimage_required';end if;
 definition:=pg_get_functiondef(target);
 execute replace(definition,old,replace(old,'if not c.bootstrap_fenced or c.paused then','if not app.closeout_catalog_verified_v20() or not c.bootstrap_fenced or c.paused then'));
end$pin$;

create function public.get_closeout_capability_v19(actor uuid,sid uuid,tid uuid,eid uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare c app.closeout_write_control_v19%rowtype;p app.closeout_runtime_pins_v20%rowtype;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role'then raise exception 'server_only_closeout_capability';end if;
 if actor is null or sid is null or tid is null or eid is null or app.selected_step_final_access_v3(actor,sid,tid,eid)is distinct from true then return null;end if;
 perform 1 from auth.sessions where id=sid and user_id=actor and(not_after is null or not_after>clock_timestamp())for share nowait;if not found then return null;end if;
 select * into strict c from app.closeout_write_control_v19 where singleton;
 select * into strict p from app.closeout_runtime_pins_v20 where singleton;
 if not c.bootstrap_fenced or not app.closeout_catalog_verified_v20()then return null;end if;
 return jsonb_build_object('kind','closeout-capability-v19','actorId',actor,'sessionId',sid,'tournamentId',tid,'eventId',eid,
  'catalogHash',p.expected_catalog_hash,'admissionSetHash',p.admission_set_hash,'controlVersion',c.version,
  'drainedVersion',c.drained_version,'paused',c.paused,'bootstrapFenced',c.bootstrap_fenced,'readAvailable',true,
  'writeAvailable',not c.paused and app.closeout_retirement_enabled_v17());
end$$;
alter function public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)owner to postgres;
revoke all on function public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
-- Expected snapshot INSERT is generated only by the exact reviewed installer;
-- this fragment cannot activate itself or auto-pin a drifted database.

do $required$declare s text;begin foreach s in array array['app.assert_closeout_operation_open_v17(uuid,uuid)','app.closeout_catalog_hash_v20(text[],text[])','app.closeout_catalog_verified_v20()','app.closeout_first_effect_fence_v20()','app.closeout_retirement_enabled_v17()','app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)','app.get_closeout_terminal_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb)','app.native_optional_finance_service_access_v2(uuid,uuid,uuid)','app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)','app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)','app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)','app.reject_immutable_history()','app.require_closeout_write_admission_v19()','app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)','app.review_native_recorded_fund_v1(uuid,uuid,jsonb)','app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)','app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)','app.set_closeout_write_pause_v19(uuid,bigint,boolean,text,text)','public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)','public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)','public.get_manual_pool_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)','public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)','public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)','public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)']::text[]loop if to_regprocedure(s)is null then raise exception 'closeout_required_function_missing: %',s;end if;end loop;foreach s in array array['app.closeout_runtime_pins_v20','app.closeout_terminal_retirements_v17','app.closeout_write_control_audit_v19','app.closeout_write_control_v19','app.manual_final_authorizations_v1','app.manual_pool_final_authorizations_v1','app.modern_event_closures_v1','app.modern_event_final_operations_v1','app.modern_prize_award_operations_v2','app.native_optional_final_operations_v2','app.native_optional_income_operations_v2','app.native_playoff_finance_write_operations_v1','app.native_playoff_finance_write_outcomes_v1','app.native_unrestricted_income_sources_v1','app.operation_receipts','app.regular_consolation_closures_v1','app.regular_consolation_final_operations_v1','app.selected_step_award_operations_v3','app.selected_step_pool_operations_v3','app.selected_step_pool_ownership_operations_v3','auth.sessions']::text[]loop if to_regclass(s)is null then raise exception 'closeout_required_relation_missing: %',s;end if;end loop;end$required$;
-- Immutable exact reviewed source-set expectation. Generated ONLY inside the
-- one-shot preimage-checked installer; never rerun this as an auto-repin tool.
insert into app.closeout_runtime_pins_v20 values(true,array['app.assert_closeout_operation_open_v17(uuid,uuid)','app.closeout_catalog_hash_v20(text[],text[])','app.closeout_catalog_verified_v20()','app.closeout_first_effect_fence_v20()','app.closeout_retirement_enabled_v17()','app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)','app.get_closeout_terminal_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb)','app.native_optional_finance_service_access_v2(uuid,uuid,uuid)','app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)','app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)','app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)','app.reject_immutable_history()','app.require_closeout_write_admission_v19()','app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)','app.review_native_recorded_fund_v1(uuid,uuid,jsonb)','app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)','app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)','app.set_closeout_write_pause_v19(uuid,bigint,boolean,text,text)','public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)','public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)','public.get_manual_pool_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)','public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)','public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)','public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)','public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)','public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)']::text[],array['app.closeout_runtime_pins_v20','app.closeout_terminal_retirements_v17','app.closeout_write_control_audit_v19','app.closeout_write_control_v19','app.manual_final_authorizations_v1','app.manual_pool_final_authorizations_v1','app.modern_event_closures_v1','app.modern_event_final_operations_v1','app.modern_prize_award_operations_v2','app.native_optional_final_operations_v2','app.native_optional_income_operations_v2','app.native_playoff_finance_write_operations_v1','app.native_playoff_finance_write_outcomes_v1','app.native_unrestricted_income_sources_v1','app.operation_receipts','app.regular_consolation_closures_v1','app.regular_consolation_final_operations_v1','app.selected_step_award_operations_v3','app.selected_step_pool_operations_v3','app.selected_step_pool_ownership_operations_v3','auth.sessions']::text[],app.closeout_catalog_hash_v20(array['app.assert_closeout_operation_open_v17(uuid,uuid)','app.closeout_catalog_hash_v20(text[],text[])','app.closeout_catalog_verified_v20()','app.closeout_first_effect_fence_v20()','app.closeout_retirement_enabled_v17()','app.finish_native_playoff_finance_write_v1(uuid,uuid,uuid,uuid,jsonb)','app.get_closeout_terminal_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb)','app.native_optional_finance_service_access_v2(uuid,uuid,uuid)','app.record_manual_final_awards_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_final_inner_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_manual_pool_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_event_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_modern_prize_awards_v2(uuid,uuid,uuid,jsonb)','app.record_native_optional_final_awards_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_optional_income_v2(uuid,uuid,uuid,uuid,jsonb)','app.record_native_playoff_final_awards_v1(uuid,uuid,jsonb)','app.record_native_unrestricted_income_v1(uuid,uuid,jsonb)','app.record_regular_consolation_closure_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_regular_consolation_final_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_awards_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.record_selected_step_pool_v3(uuid,uuid,uuid,uuid,jsonb)','app.reject_immutable_history()','app.require_closeout_write_admission_v19()','app.retire_closeout_operation_v17(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)','app.review_native_recorded_fund_v1(uuid,uuid,jsonb)','app.save_selected_step_pool_ownership_v3(uuid,uuid,uuid,uuid,jsonb)','app.selected_step_award_dispatch_write_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','app.selected_step_final_access_v3(uuid,uuid,uuid,uuid)','app.set_closeout_write_pause_v19(uuid,bigint,boolean,text,text)','public.close_event_play_v1(uuid,uuid,uuid,text,boolean,uuid)','public.close_synthetic_event_v1(uuid,uuid,uuid,uuid,text,boolean,uuid)','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','public.get_closeout_terminal_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb)','public.get_manual_pool_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_modern_event_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_closure_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.get_regular_consolation_final_operation_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_manual_pool_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_event_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_modern_prize_awards_provider_v2(uuid,uuid,uuid,jsonb)','public.record_native_playoff_final_awards_provider_v1(uuid,uuid,jsonb)','public.record_native_unrestricted_income_provider_v1(uuid,uuid,jsonb)','public.record_regular_consolation_closure_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_regular_consolation_final_provider_v1(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_awards_provider_v3(uuid,uuid,uuid,uuid,uuid,jsonb)','public.record_selected_step_pool_provider_v3(uuid,uuid,uuid,uuid,jsonb)','public.reopen_event_play_v1(uuid,uuid,uuid,text,uuid)','public.retire_closeout_operation_v18(uuid,uuid,uuid,uuid,uuid,text,jsonb,text)']::text[],array['app.closeout_runtime_pins_v20','app.closeout_terminal_retirements_v17','app.closeout_write_control_audit_v19','app.closeout_write_control_v19','app.manual_final_authorizations_v1','app.manual_pool_final_authorizations_v1','app.modern_event_closures_v1','app.modern_event_final_operations_v1','app.modern_prize_award_operations_v2','app.native_optional_final_operations_v2','app.native_optional_income_operations_v2','app.native_playoff_finance_write_operations_v1','app.native_playoff_finance_write_outcomes_v1','app.native_unrestricted_income_sources_v1','app.operation_receipts','app.regular_consolation_closures_v1','app.regular_consolation_final_operations_v1','app.selected_step_award_operations_v3','app.selected_step_pool_operations_v3','app.selected_step_pool_ownership_operations_v3','auth.sessions']::text[]),'641651b03490b19b2e22a62ebed2c9410a5d8d6b8741e497274fb5c081a56eee');

do $$begin if not app.closeout_catalog_verified_v20()or exists(select 1 from app.closeout_write_control_v19 where not paused or bootstrap_fenced)or app.closeout_retirement_enabled_v17()then raise exception 'closeout_v20_not_closed';end if;
if has_function_privilege('service_role','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','execute')or has_function_privilege('authenticated','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','execute')or has_function_privilege('anon','public.get_closeout_capability_v19(uuid,uuid,uuid,uuid)','execute')then raise exception 'closeout_v20_rpc_not_closed';end if;end$$;
commit;
