'use client';
import React,{useEffect,useRef,useState} from 'react';
import type {Contact} from '@/types/contacts';
import type * as Leaflet from 'leaflet';
export default function ContactsMap({contacts,onSelect,onPlace}:{contacts:Contact[];onSelect?:(id:string)=>void;onPlace?:(latitude:number,longitude:number)=>void}){
 const [ready,setReady]=useState(false);const selectRef=useRef(onSelect);selectRef.current=onSelect;
 const signature=JSON.stringify(contacts.map(({id,company,type,city,latitude,longitude})=>({id,company,type,city,latitude,longitude})));
 const element=useRef<HTMLDivElement>(null);const mapRef=useRef<Leaflet.Map|null>(null);const markersRef=useRef<Leaflet.LayerGroup|null>(null);const placeRef=useRef(onPlace);placeRef.current=onPlace;
 useEffect(()=>{
  let cancelled=false;
  import('leaflet').then((L)=>{
   if(cancelled||!element.current)return;
   const map=L.map(element.current,{scrollWheelZoom:false}).setView([42.4,12.6],5);mapRef.current=map;
   L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19}).addTo(map);
   markersRef.current=L.layerGroup().addTo(map);setReady(true);
   map.on('click',(event:Leaflet.LeafletMouseEvent)=>placeRef.current?.(event.latlng.lat,event.latlng.lng));
   const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(element.current);
   (map as any).__resizeObserver=observer;
  });
  return()=>{cancelled=true;if(mapRef.current){(mapRef.current as any).__resizeObserver?.disconnect();mapRef.current.remove();mapRef.current=null;markersRef.current=null;}};
 },[]);
 useEffect(()=>{
  let cancelled=false;
  import('leaflet').then((L)=>{
   const map=mapRef.current,group=markersRef.current;if(cancelled||!map||!group)return;
   group.clearLayers();const points:Leaflet.LatLngTuple[]=[];
   (JSON.parse(signature) as Contact[]).forEach((contact,index)=>{
    if(!Number.isFinite(contact.latitude)||!Number.isFinite(contact.longitude))return;
    const point:Leaflet.LatLngTuple=[contact.latitude!,contact.longitude!];points.push(point);
    const marker=L.marker(point,{icon:L.divIcon({className:'contact-map-marker',html:'<span>'+(index+1)+'</span>',iconSize:[28,28],iconAnchor:[14,28]})}).addTo(group);
    const popup=document.createElement('div');const name=document.createElement('strong');name.textContent=contact.company;popup.append(name);
    const detail=document.createElement('p');detail.textContent=[contact.type,contact.city].filter(Boolean).join(' · ');popup.append(detail);
    if(selectRef.current){const button=document.createElement('button');button.textContent='Apri scheda';button.onclick=()=>selectRef.current?.(contact.id);popup.append(button);}marker.bindPopup(popup);
   });
   if(points.length===1)map.setView(points[0],14);else if(points.length>1)map.fitBounds(L.latLngBounds(points),{padding:[30,30],maxZoom:14});
  });return()=>{cancelled=true;};
 },[signature,ready]);
 return <div className="contacts-map" ref={element} aria-label={onPlace?'Mappa: clicca per posizionare il contatto':'Mappa dei contatti filtrati'}/>;
}
